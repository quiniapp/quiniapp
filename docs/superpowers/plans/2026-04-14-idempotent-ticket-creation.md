# Idempotent Ticket Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate tickets when cashiers click "Cerrar Ticket" multiple times by adding a `client_request_id` idempotency key.

**Architecture:** The frontend generates a UUID when the first bet is added to a session and sends it with every creation request. The DB stores the key with a partial unique index. On duplicate receipt the RPC returns the already-created ticket instead of inserting again.

**Tech Stack:** PostgreSQL (Supabase RPC), Express/TypeScript (API), React/Zustand (Frontend), Zod (validation), TanStack Query (mutations).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `api/supabase/migrations/20260414090510_add_client_request_id_to_tickets.sql` | Create | DB column, index, updated RPC |
| `helper/types/ticket.type.ts` | Modify | Add `client_request_id` to `ITicketEntityBase` |
| `helper/request/ticket.request.ts` | Modify | Add `client_request_id` to `INewTicketEntity` and `INewTicketBaseEntity` |
| `helper/schemas/ticket.schema.ts` | Modify | Add optional UUID field to Zod schema |
| `api/src/ticket/repository/ticket.repository.ts` | Modify | Pass `p_client_request_id` to RPC |
| `web/src/features/make-plays/provider/MakePlaysProvider.tsx` | Modify | Generate, send, and clear UUID |

---

## Task 1: DB migration — column + index

**Files:**
- Create: `api/supabase/migrations/20260414090510_add_client_request_id_to_tickets.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration: Add client_request_id idempotency key to tickets
-- Prevents duplicate ticket creation when cashiers retry on network failure.

-- 1) Add nullable column (backwards compatible — existing rows stay NULL)
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS client_request_id UUID NULL;

-- 2) Partial unique index — only indexes non-NULL values.
--    Existing tickets (NULL) and the edit flow are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS tickets_client_request_id_idx
ON public.tickets (client_request_id)
WHERE client_request_id IS NOT NULL;
```

Save to: `api/supabase/migrations/20260414090510_add_client_request_id_to_tickets.sql`

- [ ] **Step 2: Commit**

```bash
git add api/supabase/migrations/20260414090510_add_client_request_id_to_tickets.sql
git commit -m "feat(db): add client_request_id column and index to tickets"
```

---

## Task 2: DB migration — update create_ticket_with_bets RPC

**Files:**
- Create: `api/supabase/migrations/20260414090511_sp_create_ticket_idempotency.sql`

- [ ] **Step 1: Create the migration file**

Full function — drop old signature first, then recreate with the new `p_client_request_id` parameter and idempotency handling.

```sql
-- Migration: Update create_ticket_with_bets to support idempotency key
DROP FUNCTION IF EXISTS public.create_ticket_with_bets(jsonb, UUID);

CREATE OR REPLACE FUNCTION public.create_ticket_with_bets(
  ticket jsonb,
  p_organization_id UUID,
  p_client_request_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_ticket_id uuid;
  v_now timestamptz := now();
  v_total numeric := 0;
  v_created_base timestamptz;
  v_schedule_ids UUID[];
  v_lottery_ids UUID[];
BEGIN
  -- 0a) Extract unique schedule_ids and lottery_ids from the ticket JSON
  WITH bets AS (
    SELECT b
    FROM jsonb_array_elements(ticket->'bets') AS b
  ),
  schedule_lottery_items AS (
    SELECT
      (sl->>'schedule')::uuid AS schedule_id,
      lot_id::uuid AS lottery_id
    FROM bets
    CROSS JOIN LATERAL jsonb_array_elements(b->'scheduleLottery') AS sl
    CROSS JOIN LATERAL jsonb_array_elements_text(sl->'lotteries') AS lot(lot_id)
  )
  SELECT
    ARRAY_AGG(DISTINCT schedule_id),
    ARRAY_AGG(DISTINCT lottery_id)
  INTO v_schedule_ids, v_lottery_ids
  FROM schedule_lottery_items;

  -- 0b) Validate that all schedules and lotteries are active
  IF v_schedule_ids IS NOT NULL AND v_lottery_ids IS NOT NULL THEN
    PERFORM validate_active_schedules_lotteries(v_schedule_ids, v_lottery_ids, p_organization_id);
  END IF;

  -- 0c) Calcular total = suma(amount * cantidad_de_combinaciones)
  WITH bets AS (
    SELECT b
    FROM jsonb_array_elements(ticket->'bets') AS b
  ),
  combos AS (
    SELECT
      (b.b->>'amount')::numeric AS amount,
      coalesce(sum(jsonb_array_length(sl->'lotteries')),0) AS combos_count
    FROM bets b
    LEFT JOIN LATERAL jsonb_array_elements(b.b->'scheduleLottery') AS sl ON true
    GROUP BY b.b
  )
  SELECT coalesce(sum(amount * combos_count), 0) INTO v_total
  FROM combos;

  -- 1) Insertar ticket con idempotency key.
  --    Si hay unique_violation en client_request_id, retornar el ticket existente.
  BEGIN
    INSERT INTO public.tickets (
      ticket_id, user_id, user_name, ticket_number, date,
      paid, winner, total, total_prize,
      created_at, deleted_at, deleted_by, hits, organization_id,
      client_request_id
    )
    VALUES (
      (ticket->>'ticket_id')::uuid,
      nullif(ticket->>'user_id','')::uuid,
      ticket->>'user_name',
      ticket->>'ticket_number',
      (ticket->>'date')::date,
      false,
      false,
      v_total,
      0,
      coalesce((ticket->>'created_at')::timestamptz, v_now),
      null,
      null,
      0,
      p_organization_id,
      p_client_request_id
    )
    RETURNING ticket_id, created_at INTO v_ticket_id, v_created_base;
  EXCEPTION
    WHEN unique_violation THEN
      -- Only handle if the violation is from our idempotency key
      IF p_client_request_id IS NOT NULL THEN
        SELECT ticket_id INTO v_ticket_id
        FROM public.tickets
        WHERE client_request_id = p_client_request_id
          AND organization_id = p_organization_id;

        IF FOUND THEN
          RETURN public.ticket_full_json_plpgsql(v_ticket_id, p_organization_id);
        END IF;
      END IF;
      RAISE;
  END;

  -- 2) Bulk insert de bets preservando orden por BLOQUE
  WITH raw_bets AS (
    SELECT
      v_ticket_id AS ticket_id,
      (ticket->>'user_id')::uuid AS user_id,
      ticket->>'user_name' AS user_name,
      (ticket->>'ticket_number') AS ticket_number,
      (ticket->>'date')::date AS date,
      b->>'number' AS number,
      (b->>'amount')::numeric AS amount,
      (b->>'place')::place_type_enum AS place,
      nullif(b->>'with','') AS "with",
      nullif(b->>'position','')::place_type_enum AS position,
      (b->'scheduleLottery')::jsonb AS schedule_lottery,
      bet_idx AS bet_ord
    FROM jsonb_array_elements(ticket->'bets') WITH ORDINALITY AS b(b, bet_idx)
  ),
  exploded AS (
    SELECT
      rb.*,
      sl->>'schedule' AS schedule_id_text,
      (sl->'lotteries')::jsonb AS lotteries_json,
      sched_idx AS sched_ord
    FROM raw_bets rb
    CROSS JOIN LATERAL jsonb_array_elements(rb.schedule_lottery) WITH ORDINALITY AS sl(sl, sched_idx)
  ),
  cartesian AS (
    SELECT
      ticket_id, user_id, user_name, ticket_number, date,
      number, amount, place, "with", position,
      (schedule_id_text)::uuid AS schedule_id,
      (lot_el)::uuid AS lottery_id,
      bet_ord, sched_ord, lot_ord
    FROM exploded
    CROSS JOIN LATERAL jsonb_array_elements_text(lotteries_json) WITH ORDINALITY AS lot(lot_el, lot_ord)
  ),
  numbered AS (
    SELECT
      c.*,
      bet_ord AS bet_group_order,
      row_number() over (
        PARTITION BY bet_ord
        ORDER BY sched_ord, lot_ord
      ) AS combo_rn
    FROM cartesian c
  ),
  prepared AS (
    SELECT
      gen_random_uuid() AS bet_id,
      (
        CASE
          WHEN length(number) = 1 THEN 'ONE'
          WHEN length(number) = 2 AND coalesce(length("with"),0) = 0 THEN 'DOUBLE'
          WHEN length(number) = 2 AND coalesce(length("with"),0) = 2 THEN 'REDOUBLE'
          WHEN length(number) = 3 THEN 'TERN'
          WHEN length(number) = 4 THEN 'QUATERN'
          WHEN length(number) = 10 THEN 'BORRATINA'
          ELSE null
        END
      )::bet_type_enum AS bet_type,
      ticket_id,
      user_id,
      number,
      amount,
      place,
      "with",
      position,
      date,
      false AS winner,
      false AS paid,
      lottery_id,
      schedule_id,
      ticket_number,
      user_name AS cashier_name,
      0 AS hits,
      bet_group_order AS bet_order,
      v_created_base AS created_at,
      combo_rn,
      p_organization_id AS organization_id
    FROM numbered
  )
  INSERT INTO public.bets (
    bet_id, bet_type, ticket_id, user_id, number, amount, place, "with", position,
    date, winner, paid, lottery_id, schedule_id, ticket_number, cashier_name, hits,
    bet_order, created_at, organization_id
  )
  SELECT
    bet_id, bet_type, ticket_id, user_id, number, amount, place, "with", position,
    date, winner, paid, lottery_id, schedule_id, ticket_number, cashier_name, hits,
    bet_order, created_at, organization_id
  FROM prepared
  ORDER BY bet_order, combo_rn;

  -- 3) Retornar ticket hidratado
  RETURN public.ticket_full_json_plpgsql(v_ticket_id, p_organization_id);
EXCEPTION
  WHEN others THEN
    RAISE;
END;
$$;
```

Save to: `api/supabase/migrations/20260414090511_sp_create_ticket_idempotency.sql`

- [ ] **Step 2: Commit**

```bash
git add api/supabase/migrations/20260414090511_sp_create_ticket_idempotency.sql
git commit -m "feat(db): update create_ticket_with_bets RPC with idempotency key support"
```

---

## Task 3: Shared types — add client_request_id

**Files:**
- Modify: `helper/types/ticket.type.ts`
- Modify: `helper/request/ticket.request.ts`

- [ ] **Step 1: Add `client_request_id` to `ITicketEntityBase`**

In `helper/types/ticket.type.ts`, add the optional field at the end of `ITicketEntityBase`:

```typescript
export interface ITicketEntityBase {
  ticket_id: string;
  organization_id: string;
  user_id: string | null;
  user_name: string;
  ticket_number: string;
  date: string;
  paid: boolean;
  winner: boolean;
  total: number;
  total_prize: number;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  hits: number;
  client_request_id?: string | null;  // idempotency key
}
```

- [ ] **Step 2: Add `client_request_id` to `INewTicketEntity`**

In `helper/request/ticket.request.ts`, add the optional field to `INewTicketEntity`:

```typescript
export type INewTicketEntity = Pick<ITicketEntityBase, 'user_id' | 'user_name' | 'date'> & {
  bets: IBetTable[];
  client_request_id?: string;
};
```

- [ ] **Step 3: Commit**

```bash
git add helper/types/ticket.type.ts helper/request/ticket.request.ts
git commit -m "feat(helper): add client_request_id to ticket types"
```

---

## Task 4: Zod schema validation

**Files:**
- Modify: `helper/schemas/ticket.schema.ts`

- [ ] **Step 1: Add optional UUID field to the schema**

Replace the entire file content:

```typescript
import { BetTableSchema } from './bet.schema';
import { z } from 'zod';

export const newTicketSchema = z.object({
  user_id: z.string().uuid().nullable(),
  user_name: z.string().min(1),
  date: z.string(),
  bets: z.array(BetTableSchema).min(1),
  client_request_id: z.string().uuid().optional(),
});
```

- [ ] **Step 2: Commit**

```bash
git add helper/schemas/ticket.schema.ts
git commit -m "feat(helper): add client_request_id validation to newTicketSchema"
```

---

## Task 5: Repository — pass idempotency key to RPC

**Files:**
- Modify: `api/src/ticket/repository/ticket.repository.ts`

- [ ] **Step 1: Update the `create` method to pass `p_client_request_id`**

Replace the `create` method (lines 13–20):

```typescript
async create(ticket: INewTicketBaseEntity & { organization_id: string }) {
  const { data, error } = await supabase.rpc('create_ticket_with_bets', {
    ticket: ticket,
    p_organization_id: ticket.organization_id,
    p_client_request_id: ticket.client_request_id ?? null,
  });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add api/src/ticket/repository/ticket.repository.ts
git commit -m "feat(api): pass client_request_id to create_ticket_with_bets RPC"
```

---

## Task 6: Frontend — generate, send, and clear UUID

**Files:**
- Modify: `web/src/features/make-plays/provider/MakePlaysProvider.tsx`

**Approach:** Use a `useRef` (not `useState`) for the UUID. Refs are synchronous, don't cause re-renders, and persist across re-renders — exactly what we need. The UUID is generated lazily on the first `handleCreateBet` call of a session, and cleared on success or manual reset. No changes to context type or `setBets` needed.

- [ ] **Step 1: Add `clientRequestIdRef`**

After the existing `isSubmittingRef` declaration (line 136), add:

```typescript
// Idempotency key: generated once per ticket session, cleared on success/reset.
// Using a ref (not state) so it updates synchronously without triggering re-renders.
const clientRequestIdRef = useRef<string | undefined>(undefined);
```

- [ ] **Step 2: Generate UUID lazily in `handleCreateBet`**

At the top of `handleCreateBet` (right after the `isSubmittingRef.current` guard check, around line 170), add:

```typescript
// Generate a stable idempotency key for this session if not yet set
if (!clientRequestIdRef.current) {
  clientRequestIdRef.current = crypto.randomUUID();
}
```

- [ ] **Step 3: Include `client_request_id` in the `handleCreateBet` payload**

In `handleCreateBet` (around line 184), update the `payload` object:

```typescript
const payload = {
  date: today,
  user_id: cashier?.user_id ?? user!.user_id,
  user_name: `${cashier?.name ?? user!.name}-${cashier?.number ?? user!.number}`,
  bets: bets,
  client_request_id: clientRequestIdRef.current,
};
```

- [ ] **Step 4: Clear UUID in `handleCreateBet` `onSuccess`**

In `handleCreateBet`'s `onSuccess` callback (around line 214), add alongside the other resets:

```typescript
clientRequestIdRef.current = undefined;
```

- [ ] **Step 5: Generate UUID lazily in `handleConfirmClosedSchedules`**

At the top of `handleConfirmClosedSchedules`'s submit block (right after `isSubmittingRef.current = true`, around line 334), add:

```typescript
if (!clientRequestIdRef.current) {
  clientRequestIdRef.current = crypto.randomUUID();
}
```

- [ ] **Step 6: Include `client_request_id` in the `handleConfirmClosedSchedules` payload**

In `handleConfirmClosedSchedules` (around line 337), update its `payload` object:

```typescript
const payload = {
  date: today,
  user_id: cashier?.user_id ?? user!.user_id,
  user_name: `${cashier?.name ?? user!.name}-${cashier?.number ?? user!.number}`,
  bets: cleanedBets,
  client_request_id: clientRequestIdRef.current,
};
```

- [ ] **Step 7: Clear UUID in `handleConfirmClosedSchedules` `onSuccess`**

In `handleConfirmClosedSchedules`'s `onSuccess` callback (around line 365), add alongside the other resets:

```typescript
clientRequestIdRef.current = undefined;
```

- [ ] **Step 8: Clear UUID on manual reset**

In `handleResetBets` (around line 285), add:

```typescript
const handleResetBets = useCallback(() => {
  setBets([]);
  setPartialAmount(0);
  setTotalAmount(0);
  clientRequestIdRef.current = undefined;
}, []);
```

In `handleRecreateBet` (around line 157), reset the ref so the recreated ticket gets a fresh key:

```typescript
const handleRecreateBet = useCallback(
  (values: IBetTable[]) => {
    setBets(values);
    const total = computeTotal(values);
    setPartialAmount(total);
    setTotalAmount(total);
    setSelectedIndexes([]);
    setIsEnabledCreateBet(true);
    clientRequestIdRef.current = undefined;  // will be generated on next submit
  },
  [computeTotal]
);
```

- [ ] **Step 9: Verify TypeScript compiles without errors**

```bash
cd api && npm run build
cd ../web && npm run build
```

Expected: both build successfully with no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add web/src/features/make-plays/provider/MakePlaysProvider.tsx
git commit -m "feat(web): generate and send client_request_id for idempotent ticket creation"
```

---

## Task 7: Apply migration to Supabase and final verification

- [ ] **Step 1: Apply migrations to local Supabase**

```bash
cd api && npx supabase db push
```

Expected: migrations apply cleanly, no errors.

- [ ] **Step 2: Manual smoke test**

1. Start the API: `npm run api` (port 3000)
2. Start the web: `npm run web`
3. Log in as a cashier
4. Add jugadas and click "Cerrar Ticket" rapidly 3–4 times
5. Verify only **one** ticket appears in the list

- [ ] **Step 3: Verify retry scenario**

In browser DevTools → Network, throttle to "Slow 3G". Click "Cerrar Ticket". Before the response arrives, click again. Verify only one ticket is created.

- [ ] **Step 4: Final commit (CHANGELOGs)**

Update `api/CHANGELOG.md`:

```markdown
### Added - 2026-04-14

#### Ticket Idempotency
- **client_request_id column**: Added nullable UUID column with partial unique index to `tickets` table (`migrations/20260414090510_add_client_request_id_to_tickets.sql`)
- **RPC update**: `create_ticket_with_bets` now accepts optional `p_client_request_id UUID` — returns existing ticket on duplicate key instead of inserting again (`migrations/20260414090511_sp_create_ticket_idempotency.sql`)
- **Repository**: `TicketRepository.create` passes `p_client_request_id` to the RPC
```

Update `helper/CHANGELOG.md`:

```markdown
### Added - 2026-04-14

#### Ticket Types
- **`client_request_id`**: Added optional field to `ITicketEntityBase`, `INewTicketEntity`, and `newTicketSchema` for idempotency key support
```

Update `web/CHANGELOG.md`:

```markdown
### Added - 2026-04-14

#### Ticket Idempotency
- **`MakePlaysProvider`**: Generates a `client_request_id` UUID when the first bet is added to a session; sends it with every ticket creation request; clears it on success, manual reset, and recreate
- **Why**: Prevents duplicate tickets when cashiers retry after a network failure — the server returns the already-created ticket on duplicate key
```

```bash
git add api/CHANGELOG.md helper/CHANGELOG.md web/CHANGELOG.md
git commit -m "docs: update CHANGELOGs for idempotent ticket creation"
```
