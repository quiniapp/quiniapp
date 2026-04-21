# Concurrency Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 8 concurrency/race-condition bugs that cause mass session logouts, data loss, and unsafe concurrent writes under peak load.

**Architecture:** Mix of DB migrations (new RPCs/fixes), backend TypeScript changes, and frontend auth unification. Tasks 1-3 are independent. Tasks 4-8 are independent from each other and from 1-3. No task depends on another except Task 3 is easier to reason about after Task 2 exists.

**Tech Stack:** Express.js/TypeScript (api/), React/TanStack Query (web/), Supabase/PostgreSQL, jsonwebtoken, bcrypt.

---

## Files to create or modify

| File | Action | Reason |
|------|--------|--------|
| `web/src/lib/apiClient.ts` | Modify | Add `fetchRaw()` method with refresh logic |
| `web/src/lib/fetchWithAuth.ts` | Modify | Route through apiClient.fetchRaw instead of raw fetch |
| `api/src/session/cache/session-activity.cache.ts` | Modify | Add `restore()` method for re-merge on flush error |
| `api/src/session/job/session-monitor.job.ts` | Modify | Re-merge snapshot on batchUpdateActivity failure |
| `api/src/auth/controller/auth.controller.ts` | Modify | Check token_version before hash comparison; remove TOCTOU session limit logic |
| `api/src/auth/repository/auth.repository.ts` | Modify | Remove racy SELECT+UPDATE fallback in incrementFailedAttempts |
| `api/src/session/repository/session.repository.ts` | Modify | Use create_session_with_limit RPC |
| `api/supabase/migrations/20260419100000_fix_batch_update_session_activity_greatest.sql` | Create | GREATEST() for timestamps |
| `api/supabase/migrations/20260419100001_fix_pay_ticket_for_update.sql` | Create | SELECT FOR UPDATE before UPDATE |
| `api/supabase/migrations/20260419100002_add_create_session_with_limit_rpc.sql` | Create | Atomic count+revoke+insert for concurrent session limit |
| `api/supabase/migrations/20260419100003_fix_calculate_current_account_advisory_lock.sql` | Create | pg_advisory_xact_lock per (org, date) |
| `web/CHANGELOG.md` | Modify | Document frontend changes |
| `api/CHANGELOG.md` | Modify | Document backend/migration changes |

---

## Task 1: fetchWithAuth → shared refresh mutex

**Problem:** `fetchWithAuth` dispatches `AUTH_EXPIRED` immediately on 401 without attempting a token refresh. If it fires concurrently with an `apiClient` request that gets 401, two calls to `/api/auth/refresh` happen simultaneously with the same refresh token cookie → first one rotates the token → second one triggers `token_reuse_detected` → `revokeAllUserSessions()` → both devices logged out.

**Fix:** Add `fetchRaw()` to apiClient that routes through the same `isRefreshing` mutex. Replace fetchWithAuth body with this.

**Files:**
- Modify: `web/src/lib/apiClient.ts`
- Modify: `web/src/lib/fetchWithAuth.ts`

- [ ] **Step 1: Add `fetchRaw` to ApiClient class in `web/src/lib/apiClient.ts`**

Add this method after `safeRefresh()` (around line 230):

```typescript
async fetchRaw(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { credentials: 'include', ...init });
  if (res.status !== 401) return res;

  if (this.isRefreshing) {
    await new Promise<void>((resolve, reject) => {
      this.refreshQueue.push({ resolve: () => resolve(), reject });
    });
    return fetch(input, { credentials: 'include', ...init });
  }

  this.isRefreshing = true;
  try {
    const success = await this.refreshAccessToken();
    if (success) {
      this.processPendingRequests(null);
      return fetch(input, { credentials: 'include', ...init });
    } else {
      dispatchAuthExpired();
      const error = new Error('Sesión expirada');
      this.processPendingRequests(error);
      throw error;
    }
  } finally {
    this.isRefreshing = false;
  }
}
```

- [ ] **Step 2: Update `web/src/lib/fetchWithAuth.ts` to use apiClient.fetchRaw**

Replace entire file content:

```typescript
import { apiClient } from './apiClient';

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return apiClient.fetchRaw(input, init);
}
```

- [ ] **Step 3: Verify TypeScript compiles with no errors**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors related to fetchWithAuth or apiClient.

- [ ] **Step 4: Manual smoke test**

Start API (`npm run api`) and web (`npm run web`). Log in on two browser tabs with the same account. Let access token expire (~15 min, or reduce `JWT_ACCESS_EXPIRATION` to `1m` in `.env` for testing). Make a request in both tabs simultaneously. Confirm neither tab logs out unexpectedly.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/apiClient.ts web/src/lib/fetchWithAuth.ts
git commit -m "fix: route fetchWithAuth through apiClient refresh mutex to prevent concurrent refresh"
```

---

## Task 2: GREATEST() in batch_update_session_activity

**Problem:** The RPC blindly overwrites `last_activity_at` and `expires_at`. Under two server instances (or concurrent flushes), the later flush can write an *older* timestamp, regressing the session expiry and causing spurious logouts.

**Files:**
- Create: `api/supabase/migrations/20260419100000_fix_batch_update_session_activity_greatest.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration: Fix batch_update_session_activity to use GREATEST() to prevent timestamp regression
-- Date: 2026-04-19

CREATE OR REPLACE FUNCTION batch_update_session_activity(
  p_session_ids UUID[],
  p_activity_times TIMESTAMPTZ[],
  p_expiry_times TIMESTAMPTZ[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sessions s
  SET
    last_activity_at = GREATEST(s.last_activity_at, data.last_activity_at),
    expires_at       = GREATEST(s.expires_at,       data.expires_at)
  FROM UNNEST(p_session_ids, p_activity_times, p_expiry_times)
    AS data(session_id, last_activity_at, expires_at)
  WHERE s.session_id = data.session_id
    AND s.is_active = TRUE;
END;
$$;

COMMENT ON FUNCTION batch_update_session_activity IS
  'Batch updates last_activity_at and expires_at for multiple sessions. Uses GREATEST() to prevent concurrent flushes from regressing timestamps.';
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
cd api && npx supabase db push
```

Expected: migration applied successfully, no errors.

- [ ] **Step 3: Commit**

```bash
git add api/supabase/migrations/20260419100000_fix_batch_update_session_activity_greatest.sql
git commit -m "fix(db): use GREATEST() in batch_update_session_activity to prevent timestamp regression"
```

---

## Task 3: Activity flush re-merge on error

**Problem:** `snapshotAndClear()` clears the in-memory map *before* writing to DB. If the DB write fails, up to 30 minutes of activity is lost — all active users appear inactive at the next expiry check and get logged out.

**Files:**
- Modify: `api/src/session/cache/session-activity.cache.ts`
- Modify: `api/src/session/job/session-monitor.job.ts`

- [ ] **Step 1: Add `restore()` method to SessionActivityCache in `session-activity.cache.ts`**

Add after the `delete()` method (around line 28):

```typescript
restore(sessionId: string, entry: ActivityCacheEntry): void {
  const current = this.map.get(sessionId);
  if (!current || current.last_activity_at < entry.last_activity_at) {
    this.map.set(sessionId, entry);
  }
}
```

- [ ] **Step 2: Update `flushActivityCache` in `session-monitor.job.ts` to re-merge on error**

Replace lines 9-20 with:

```typescript
export async function flushActivityCache(): Promise<void> {
  const snapshot = activityCache.snapshotAndClear();
  if (snapshot.size === 0) return;

  try {
    await sessionRepository.batchUpdateActivity(snapshot);
    console.log(`[SessionMonitor] Flushed ${snapshot.size} activity entries to DB`);
  } catch (err) {
    console.error('[SessionMonitor] Failed to flush activity cache — re-merging to prevent data loss:', err);
    for (const [id, entry] of snapshot) {
      activityCache.restore(id, entry);
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add api/src/session/cache/session-activity.cache.ts api/src/session/job/session-monitor.job.ts
git commit -m "fix: re-merge activity cache snapshot on flush failure to prevent mass session expiry"
```

---

## Task 4: pay_ticket FOR UPDATE

**Problem:** `pay_ticket` reads ticket state (`paid`, `winner`) in a plain `SELECT`, then updates separately. Two concurrent double-clicks can both pass the `paid = FALSE` check and both execute the update — if any accounting side-effects are ever added, they'd fire twice.

**Files:**
- Create: `api/supabase/migrations/20260419100001_fix_pay_ticket_for_update.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration: Add SELECT FOR UPDATE to pay_ticket to serialize concurrent payment attempts
-- Date: 2026-04-19

CREATE OR REPLACE FUNCTION pay_ticket(
  p_ticket_number TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_id UUID;
  v_ticket_user_id UUID;
  v_ticket_paid BOOLEAN;
  v_bets_updated INTEGER;
  v_current_timestamp TIMESTAMPTZ;
BEGIN
  v_current_timestamp := NOW();

  -- 1. Lock the row before reading to serialize concurrent payment attempts
  SELECT ticket_id, user_id, paid
  INTO v_ticket_id, v_ticket_user_id, v_ticket_paid
  FROM tickets
  WHERE ticket_number = p_ticket_number
    AND winner = TRUE
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  IF v_ticket_user_id != p_user_id THEN
    RAISE EXCEPTION 'TICKET_NOT_OWNED';
  END IF;

  IF v_ticket_paid = TRUE THEN
    RAISE EXCEPTION 'TICKET_ALREADY_PAID';
  END IF;

  UPDATE tickets
  SET paid = TRUE
  WHERE ticket_id = v_ticket_id;

  UPDATE bets
  SET
    paid = TRUE,
    edited_at = v_current_timestamp
  WHERE ticket_id = v_ticket_id
    AND winner = TRUE
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_bets_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'bets_updated', v_bets_updated
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;
```

- [ ] **Step 2: Apply migration**

```bash
cd api && npx supabase db push
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add api/supabase/migrations/20260419100001_fix_pay_ticket_for_update.sql
git commit -m "fix(db): add SELECT FOR UPDATE to pay_ticket to serialize concurrent payment attempts"
```

---

## Task 5: rotateRefreshToken optimistic lock via version check

**Problem:** In `auth.controller.ts:refreshToken`, the hash comparison (bcrypt, expensive) runs but there's no check on `token_version` first. Two concurrent refreshes from multiple browser tabs both pass the hash check (same token, same hash), both compute `newVersion = current + 1`, and both call `rotateRefreshToken`. The second one writes over the first. When the first tab presents its rotated token, hash comparison fails → `revokeAllUserSessions` → all devices logged out.

**Fix:** Check `decoded.token_version` against `session.refresh_token_version` BEFORE the hash comparison. If versions differ, the token is stale (concurrent refresh already succeeded) → return 401 without revoking all sessions. The client retries with the new cookie set by the winning refresh.

**Files:**
- Modify: `api/src/auth/controller/auth.controller.ts` (lines 233-286)

- [ ] **Step 1: Add version check before hash comparison in `refreshToken` method**

In `auth.controller.ts`, find the `refreshToken` method. After step 3 (expiry check, around line 263) and before step 4 (hash comparison, around line 266), insert:

```typescript
// 3.5. Check token version before expensive bcrypt comparison
// If version doesn't match, a concurrent refresh already rotated this session.
// This is not an attack — the winning refresh already set the new cookie.
if (decoded.token_version !== session.refresh_token_version) {
  await this.auditRepository.log({
    user_id: session.user_id,
    session_id: session.session_id,
    event_type: 'refresh_token_stale_version',
    success: false,
    error_message: `Stale version: JWT has ${decoded.token_version}, DB has ${session.refresh_token_version}`,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
  throw new UnauthorizedError('Sesión actualizada concurrentemente. Reintente.');
}
```

- [ ] **Step 2: Verify the decoded object has token_version**

In `JWT.ts`, `verifyRefreshToken` returns `IRefreshTokenPayload` which includes `token_version: number` (line 63). The `decoded` variable in `refreshToken` is already typed as `ReturnType<typeof verifyRefreshToken>` so `decoded.token_version` is valid. No changes needed to JWT.ts.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add api/src/auth/controller/auth.controller.ts
git commit -m "fix: check token_version before bcrypt comparison to prevent false token-reuse detection on concurrent refresh"
```

---

## Task 6: incrementFailedAttempts — remove racy fallback

**Problem:** `auth.repository.ts:incrementFailedAttempts` has a fallback path that does `SELECT failed_login_attempts` then `UPDATE ... SET failed_login_attempts = (old + 1)`. Two concurrent failed logins both read `n=3`, both write `n=4` — effectively counting as one attempt. The `MAX_FAILED_ATTEMPTS` lockout (5 attempts) can be bypassed.

**Fix:** Remove the racy fallback. The primary RPC `increment_failed_attempts` is defined in the migrations and is atomic. If it fails, log and continue (failed_attempts is a security nicety; the login still fails for other reasons).

**Files:**
- Modify: `api/src/auth/repository/auth.repository.ts` (lines 57-85)

- [ ] **Step 1: Replace `incrementFailedAttempts` with atomic-only version**

```typescript
async incrementFailedAttempts(userId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_failed_attempts', {
    p_user_id: userId,
  });
  if (error) {
    console.error('[AuthRepository] increment_failed_attempts RPC failed:', error);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add api/src/auth/repository/auth.repository.ts
git commit -m "fix: remove racy SELECT+UPDATE fallback in incrementFailedAttempts, use atomic RPC only"
```

---

## Task 7: create_session_with_limit — atomic count+revoke+insert

**Problem:** In `auth.controller.ts:loginWithSession` (lines 141-146), `countActiveSessions` and `revokeOldestSession` are two separate queries with no locking. Two concurrent logins when `count = MAX-1`: both read `count = MAX-1`, neither revokes, both insert → exceeds the limit. Currently dormant (`MAX_CONCURRENT_SESSIONS` defaults to `0`), but arms immediately when set.

**Fix:** Move count+revoke+insert into a single Postgres function in one transaction. Backend calls one RPC instead of three separate operations.

**Files:**
- Create: `api/supabase/migrations/20260419100002_add_create_session_with_limit_rpc.sql`
- Modify: `api/src/session/repository/session.repository.ts`
- Modify: `api/src/auth/controller/auth.controller.ts`

- [ ] **Step 1: Create migration with atomic RPC**

```sql
-- Migration: Atomic session creation with concurrent session limit enforcement
-- Date: 2026-04-19

CREATE OR REPLACE FUNCTION create_session_with_limit(
  p_user_id UUID,
  p_organization_id UUID,
  p_refresh_token_hash TEXT,
  p_ip_address INET,
  p_user_agent TEXT,
  p_max_sessions INT,
  p_expires_at TIMESTAMPTZ
)
RETURNS sessions
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_session sessions;
BEGIN
  -- Lock all active sessions for this user to prevent TOCTOU on the count
  SELECT COUNT(*) INTO v_count
  FROM sessions
  WHERE user_id = p_user_id AND is_active = TRUE
  FOR UPDATE;

  -- Revoke oldest sessions until under limit
  IF p_max_sessions > 0 THEN
    WHILE v_count >= p_max_sessions LOOP
      UPDATE sessions
      SET
        is_active = FALSE,
        revoked_at = NOW(),
        revoked_reason = 'max_concurrent_sessions_exceeded'
      WHERE session_id = (
        SELECT session_id
        FROM sessions
        WHERE user_id = p_user_id AND is_active = TRUE
        ORDER BY created_at ASC
        LIMIT 1
      );
      v_count := v_count - 1;
    END LOOP;
  END IF;

  -- Insert new session
  INSERT INTO sessions (
    user_id,
    organization_id,
    refresh_token_hash,
    refresh_token_version,
    ip_address,
    user_agent,
    created_at,
    last_activity_at,
    expires_at,
    is_active
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_refresh_token_hash,
    1,
    p_ip_address,
    p_user_agent,
    NOW(),
    NOW(),
    p_expires_at,
    TRUE
  )
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

COMMENT ON FUNCTION create_session_with_limit IS
  'Atomically enforces concurrent session limit then creates new session. Uses FOR UPDATE lock to prevent TOCTOU race on session count.';
```

- [ ] **Step 2: Apply migration**

```bash
cd api && npx supabase db push
```

Expected: no errors.

- [ ] **Step 3: Add `createWithLimit` method to `SessionRepository`**

In `api/src/session/repository/session.repository.ts`, add after the `create()` method:

```typescript
async createWithLimit(params: ICreateSessionParams, maxSessions: number, expiresAt: Date): Promise<ISession> {
  const { data, error } = await supabase
    .rpc('create_session_with_limit', {
      p_user_id: params.user_id,
      p_organization_id: params.organization_id,
      p_refresh_token_hash: params.refresh_token_hash,
      p_ip_address: params.ip_address || null,
      p_user_agent: params.user_agent || null,
      p_max_sessions: maxSessions,
      p_expires_at: expiresAt.toISOString(),
    })
    .single();

  if (error || !data) {
    console.error('[SessionRepository] Failed to create session with limit:', error);
    throw new InternalServerError('Failed to create session');
  }

  return this.mapToSession(data as Record<string, unknown>);
}
```

- [ ] **Step 4: Update `auth.controller.ts:loginWithSession` to use `createWithLimit`**

Replace lines 141-158 (the concurrent-sessions block + create block):

```typescript
// 5. Create session atomically (enforces concurrent session limit if configured)
const now = new Date();
const expiresAt = new Date(now.getTime() + SESSION_CONFIG.INACTIVITY_TIMEOUT);
const tempRefreshToken = signRefreshToken(userData.user_id, 'temp', 1);
const refreshTokenHash = await hashPassword(tempRefreshToken);

const session = await this.sessionRepository.createWithLimit(
  {
    user_id: userData.user_id,
    organization_id: userData.organization_id,
    refresh_token_hash: refreshTokenHash,
    ip_address: ipAddress,
    user_agent: userAgent,
  },
  SESSION_CONFIG.MAX_CONCURRENT_SESSIONS,
  expiresAt
);
```

Remove the now-unused `countActiveSessions` and `revokeOldestSession` calls that were there before.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Test login flow**

Start API. Log in. Confirm session is created. Log in again. Confirm both sessions exist (with `MAX_CONCURRENT_SESSIONS=0`). Set `MAX_CONCURRENT_SESSIONS=1` in env, restart, log in twice — confirm only 1 active session exists after second login.

- [ ] **Step 7: Commit**

```bash
git add api/supabase/migrations/20260419100002_add_create_session_with_limit_rpc.sql \
        api/src/session/repository/session.repository.ts \
        api/src/auth/controller/auth.controller.ts
git commit -m "fix: atomic session creation with concurrent limit enforcement using FOR UPDATE lock"
```

---

## Task 8: calculate_current_account advisory lock

**Problem:** Two admins sharing the same account both click "liquidar" for the same org+date simultaneously. Both run N parallel `update_current_account_recompute` calls (serialized per-row by `FOR UPDATE`), then both run `calculate_current_account`. The second `calculateCurrentAccount` may read state that's only partially committed by the first admin's parallel writes, producing incorrect daily balances.

**Fix:** Add `pg_advisory_xact_lock(hashtext(org_id::text || ':' || date))` at the start of the `calculate_current_account` RPC. Both admins' calculate calls serialize; the second waits until the first (and its preceding writes) commit.

**Files:**
- Create: `api/supabase/migrations/20260419100003_fix_calculate_current_account_advisory_lock.sql`

- [ ] **Step 1: Read the current latest `calculate_current_account` migration to get the full function body**

```bash
ls api/supabase/migrations/ | grep calculate_current_account | sort | tail -1
```

Read that file completely. The new migration must reproduce the full function with the advisory lock added at the top of the `BEGIN` block.

- [ ] **Step 2: Create migration with advisory lock**

The migration must:
1. `DROP FUNCTION IF EXISTS calculate_current_account(...)` with the exact signature from the latest version
2. Recreate with `PERFORM pg_advisory_xact_lock(hashtext(p_organization_id::text || ':' || p_date_text));` as the first statement inside `BEGIN`

Template (fill in the full function body from step 1):

```sql
-- Migration: Add advisory lock to calculate_current_account to serialize concurrent bulk liquidations
-- Date: 2026-04-19

DROP FUNCTION IF EXISTS calculate_current_account(/* exact params from latest version */);

CREATE OR REPLACE FUNCTION calculate_current_account(
  /* exact params from latest version */
)
/* exact return type */
LANGUAGE plpgsql
AS $$
/* exact DECLARE block */
BEGIN
  -- Serialize concurrent calculate calls for same org+date to prevent partial-state reads
  PERFORM pg_advisory_xact_lock(hashtext(p_organization_id::text || ':' || p_date_text));

  /* rest of function body unchanged */
END;
$$;
```

**Note:** If `calculate_current_account` doesn't currently accept `p_organization_id`, check `api/src/current-account/controller/current-account.controller.ts` and the related migration to see how org_id filtering is done. The advisory lock key must include a unique per-org identifier — use whatever org-scoping mechanism already exists.

- [ ] **Step 3: Apply migration**

```bash
cd api && npx supabase db push
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add api/supabase/migrations/20260419100003_fix_calculate_current_account_advisory_lock.sql
git commit -m "fix(db): advisory lock in calculate_current_account to serialize concurrent bulk liquidations"
```

---

## Task 9: Update CHANGELOGs

- [ ] **Step 1: Update `api/CHANGELOG.md`**

Under `## [Unreleased]`, add:

```markdown
### Fixed - 2026-04-19

#### Concurrency and race condition hardening
- **`api/src/auth/controller/auth.controller.ts`**: Check `token_version` from JWT against DB before bcrypt hash comparison. Concurrent refreshes from multiple tabs no longer trigger false `token_reuse_detected` → `revokeAllUserSessions`.
- **`api/src/auth/repository/auth.repository.ts`**: Removed racy SELECT+UPDATE fallback in `incrementFailedAttempts`. Failed login count is now always atomic via the `increment_failed_attempts` RPC.
- **`api/src/session/cache/session-activity.cache.ts`**: Added `restore()` method.
- **`api/src/session/job/session-monitor.job.ts`**: Re-merge activity snapshot back to cache on DB flush failure — prevents mass session expiry on transient Supabase errors.
- **`api/src/session/repository/session.repository.ts`**: Added `createWithLimit()` using `create_session_with_limit` RPC for atomic concurrent-session enforcement.
- **`api/supabase/migrations/20260419100000`**: `batch_update_session_activity` now uses `GREATEST()` to prevent timestamp regression under concurrent flushes.
- **`api/supabase/migrations/20260419100001`**: `pay_ticket` adds `SELECT ... FOR UPDATE` before UPDATE to serialize concurrent payment attempts.
- **`api/supabase/migrations/20260419100002`**: `create_session_with_limit` RPC atomically enforces concurrent session limit with `FOR UPDATE` lock.
- **`api/supabase/migrations/20260419100003`**: `calculate_current_account` acquires `pg_advisory_xact_lock(org:date)` to serialize concurrent bulk liquidations.
```

- [ ] **Step 2: Update `web/CHANGELOG.md`** (already partially done in the session fix commit — verify the fetchWithAuth entry is there, add if missing)

- [ ] **Step 3: Commit changelogs**

```bash
git add api/CHANGELOG.md web/CHANGELOG.md
git commit -m "docs: update changelogs for concurrency fixes"
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 1: fetchWithAuth → apiClient (item 1)
- ✅ Task 2+3: Activity flush GREATEST + re-merge (item 4)
- ✅ Task 4: pay_ticket FOR UPDATE (item 8)
- ✅ Task 5: rotateRefreshToken version check (item 7)
- ✅ Task 6: incrementFailedAttempts atomic (item 9)
- ✅ Task 7: create_session_with_limit (item 6)
- ✅ Task 8: calculate_current_account advisory lock (item 3)

**Gap identified in Task 8:** `calculate_current_account` signature is read from an older migration — implementer MUST read the latest version of the function before writing the DROP+CREATE. This is flagged explicitly in Step 1.

**Type consistency:** `ICreateSessionParams` (already defined in session.repository.ts) is reused in `createWithLimit`. `mapToSession` is called with `data as Record<string, unknown>` matching existing pattern. `ActivityCacheEntry` type from session-activity.cache.ts is used in `restore()` — consistent with `get()` return type.
