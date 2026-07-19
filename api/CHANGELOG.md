# Changelog 

All notable changes to the API workspace are documented in this file.

## [Unreleased]

### Added - 2026-07-19 (Backdated tickets)

#### `ticketBase` honra la fecha enviada para roles no-cajero
- **`api/src/ticket/helper/ticketBase.ts`**: nueva opción `{ allowCustomDate }`. Cuando es `true` y el `date` del payload cumple `YYYY-MM-DD` (`dateRegex` de helper) y no es futuro (comparado contra hoy en `America/Argentina/Buenos_Aires`), se persiste esa fecha en `date`; en cualquier otro caso se fuerza hoy (comportamiento previo). `created_at` y `ticket_number` siguen generándose SIEMPRE con el timestamp real de creación (rastro de auditoría).
- **`api/src/ticket/controller/ticket.controller.ts`**: `create` pasa `allowCustomDate: !isCashier` — un cajero nunca puede backdatear aunque manipule el payload; defensa en profundidad respecto del guard de UI.
- Sin migración SQL: la RPC `create_ticket_with_bets` ya insertaba `(ticket->>'date')::date`; el server era quien la pisaba.

### Added - 2026-07-19 (Log Sanitization)

#### Sensitive data redaction in error logs (ISO 27001 A.8.15 / A.8.12)
- **`api/src/utils/sanitize-log.ts`** — `sanitizeForLog()` deep-copies any value replacing fields whose key contains `password`, `token`, `secret`, `authorization`, `cookie` or `refresh` (case-insensitive) with `[REDACTED]`. Tests in `sanitize-log.test.ts` (node:test, 6 cases).
- **`api/src/middlewares/error.middleware.ts`** — the error handler now passes `req.body`, `req.params` and `req.query` through `sanitizeForLog` before logging. Previously a failed login logged the plaintext password in the request body.

### Added - 2026-07-18 (Schema Cleanup)

#### Migration `20260718213215_schema_cleanup_indexes_types.sql`
Part 2 of the schema audit (out-of-scope items from the security hardening migration).
- **Dropped 16 redundant indexes**: exact duplicates (`idx_sessions_refresh_token_hash` vs the UNIQUE constraint, `idx_bets_archive_bet_id`/`idx_tickets_archive_ticket_id` vs their PKs), prefixes of wider composite indexes (`idx_bets_schedule_date`, `idx_bets_organization_id`, `idx_bets_user_id`, `idx_tpt_date`, `idx_tpt_date_schedule`, `idx_schedule_lotteries_org_day`, `idx_schedule_lotteries_organization_id`, `idx_schedule_lotteries_org_schedule`, `idx_results_lottery_id`, `idx_results_schedule_id`, `idx_users_username_active`), and low-selectivity boolean indexes (`idx_bets_paid`, `idx_sessions_is_active`). Reduces write amplification on `bets`/`tickets`.
- **Type consistency**: `schedules.created_at/edited_at` converted from `timestamp` to `timestamptz` (values reinterpreted as UTC; JSON output now carries an explicit offset); `bets.prize`, `bets_archive.prize`, `tickets.total_prize`, `tickets_archive.total_prize` converted from bare `numeric` to `numeric(12,2)` to match the other money columns.
- **Dropped legacy `users.password` column** — replaced by `password_hash` long ago; the API only touches `password_hash`. The migration aborts with an exception if any row still holds a non-empty value.
- **Fixed `hard_delete_organization`** — it failed on organizations with expenses (`fk_org_expenses_organization` is `ON DELETE RESTRICT`) because it never deleted `org_expenses`; it also left orphan rows in `bets_archive`/`tickets_archive` (no FK on `organization_id` there). Both now deleted explicitly.

### Added - 2026-07-18 (Security Hardening)

#### Migration `20260718153406_security_hardening_revoke_grants.sql`
Findings from full schema audit of the develop database dump (pre-migration to the new Supabase project). The API talks to the database only with the `service_role` key, so nothing here affects the backend.
- **RLS enabled** on `org_expenses`, `analytics_client_stats`, `analytics_device_stats` — they were the only tables without it while being granted to `anon` (readable/writable through the Data API with the anon key).
- **Dropped `process_bets()`** — legacy winners calculation, no organization awareness, wrong loop bounds for `place = TWENTY` (1..10 instead of 1..20) and REDOUBLE multipliers inconsistent with `calculate_redouble_payout`. Superseded by `generate_winners`.
- **Dropped `pay_ticket(text, uuid)`** — legacy overload without organization filter; `ticket_number` is unique per org, so it could pay another org's ticket.
- **Fixed `pay_ticket(text, uuid, uuid)`** — restored `FOR UPDATE` (lost vs. the legacy version) to serialize concurrent payment attempts; also pinned `search_path`.
- **Pinned `search_path` on `create_ticket_with_bets`** — it is `SECURITY DEFINER` and was the only one without it (search-path hijack risk).
- **Revoked all privileges** on tables/sequences/functions in `public` from `anon` and `authenticated`, plus `EXECUTE` from `PUBLIC` (blocks anon-key RPC calls to `SECURITY DEFINER` functions like `hard_delete_organization`). Default privileges reset so future objects are not auto-granted.

### Added - 2026-06-27 (High Availability)

#### Backup backend / transparent failover (Railway main + Render backup)
- **Health endpoints** — `api/src/health/health.route.ts` (mounted in `api/src/index.ts` before
  auth/csrf/rate-limit/logging):
  - `GET /health` — shallow liveness `{ status, instance, uptime }`. Used by the keep-warm pinger
    and uptime monitors. Reachable directly on the backend host, not only via the Vercel proxy.
  - `GET /health/deep` — verifies Supabase connectivity (cheap `SELECT`), returns 200/503.
- **Job gating** — `api/src/index.ts`: singleton jobs (archive cron + session cleanup) now run only
  when `ENABLE_BACKGROUND_JOBS=true`, so the passive backup doesn't double-execute them. Per-instance
  flush jobs (session monitor + device stats) keep running on every instance so each persists the
  buffer of requests it served (matters when the backup serves traffic during a failover).
- **Keep-warm job** — `api/src/utils/keep-warm.job.ts`: the main instance pings the backup's `/health`
  every 10 min (gated by `ENABLE_BACKGROUND_JOBS`, no-op when `BACKUP_HEALTH_URL` unset) to keep
  Render's free tier from sleeping.
- **New envs** — `api/envs.ts` + `.env.example`: `INSTANCE_NAME` (default `main`),
  `ENABLE_BACKGROUND_JOBS` (default `true`), `BACKUP_HEALTH_URL` (optional).
- **Production start script** — `api/package.json`: added `start: tsx src/index.ts` (no compiled
  dist/ exists and the project uses tsconfig path aliases, so tsx is the runtime, same as dev).
- **Deploy** — `render.yaml` (repo root): free-tier web service for the backup with
  `ENABLE_BACKGROUND_JOBS=false`. **Requires identical JWT secrets, Supabase config and cookie
  settings as Railway** so sessions survive the switch.

### Changed - 2026-05-16 (Rate Limiting)

#### Rate Limit Tuning — CGNAT tolerance
- **`api/src/config/rate-limit.config.ts`**: Adjusted hard caps and slow-down thresholds to prevent false positives for users sharing IPs via CGNAT
  - PRIVATE hard cap: 2000 → 5000 / 5 min (was 15 min)
  - PUBLIC hard cap: 2000 → 3000 / 5 min (was 15 min)
  - LOGIN slow-down: 5 req/5s → 20 req/30s (wider window for fast typers)
  - PUBLIC slow-down: 40 req/10s → 60 req/10s
  - Why: lottery agencies in same ISP area share the same public IP (CGNAT); previous limits triggered disconnections under concurrent normal usage

### Fixed - 2026-05-16

#### Current Account
- **Leave in subtotal drag bug**: When `p_leave_in_subtotal = TRUE`, drag was incorrectly recalculated as `prev_drag + subtotal` (where subtotal already had leave deducted), reducing the drag carry-over by the leave amount
  - Fix: drag always stored as `prev_drag + revenue` regardless of `p_leave_in_subtotal`; only `subtotal` absorbs the leave deduction
  - Migration: `api/supabase/migrations/20260516140000_fix_leave_in_subtotal_drag.sql`
  - Functions fixed: `update_current_account_recompute`, `calculate_current_account`

### Added - 2026-05-16

#### Current Account
- **Leave in subtotal**: New `leave_in_subtotal=true` query param on `PUT /api/private/current_account/:id`
  - When enabled: stores `subtotal = revenue - leave` and `drag = prev_drag + revenue` (leave absorbed in subtotal only)
  - Total changes because subtotal changes; drag carries full revenue forward to subsequent days
  - RPC: `update_current_account_recompute` updated with `p_leave_in_subtotal` param
  - Files: `api/src/current-account/route/current-account.route.ts`, `controller/current-account.controller.ts`, `repository/current-account.repository.ts`

### Added - 2026-05-16 (Security)

#### CSRF Protection
- **CSRF middleware**: `api/src/middlewares/csrf.middleware.ts` — validates `X-Requested-With: XMLHttpRequest` on all state-changing requests (POST/PUT/PATCH/DELETE)
  - Returns 403 `FORBIDDEN` if header is absent
  - Safe methods (GET/HEAD/OPTIONS) bypass the check
  - Applied globally in `api/src/index.ts` after `cookieParser()`
- **Hard-cap rate limiters**: Added permissive `express-rate-limit` alongside slow-down to satisfy CodeQL `js/missing-rate-limiting`
  - Limits: login 100/15min, auth 500/15min, public/private 2000/15min
  - All configurable via env vars (`RATE_LIMIT_*_MAX`)
  - Files: `api/src/config/rate-limit.config.ts`, `api/src/middlewares/rate-limit.middleware.ts`, `api/src/index.ts`

### Changed - 2026-05-16

#### Auth
- **Rate Limiting**: Replaced all rate limiters with silent slow-down middleware (`express-slow-down`)
  - Removed: `loginRateLimiter`, `authRateLimiter`, `publicApiRateLimiter`, `privateApiRateLimiter`
  - Added: slow-down per tier (login: 5 req/5s → 5s delay; auth: 15 req/10s → 3s; public: 40 req/10s → 2s; private: 80 req/10s → 2s)
  - Files: `api/src/config/rate-limit.config.ts`, `api/src/middlewares/rate-limit.middleware.ts`, `api/src/index.ts`
- **Account Lockout**: Removed account locking on failed password attempts
  - Wrong password no longer increments failed attempt counter or locks account
  - Users can enter wrong password unlimited times without any block
  - Removed: `MAX_FAILED_ATTEMPTS`, `LOCKOUT_DURATION` from `session.config.ts`
  - Files: `api/src/auth/controller/auth.controller.ts`, `api/src/config/session.config.ts`

### Changed - 2026-05-02

#### Liquidación Individual — campos manuales expandidos

- **`api/src/current-account/controller/current-account.controller.ts`**: `AllowedManualKeys` ahora incluye `pass`, `successes`, `drag`, `revenue`. El payload de `updateCurrentAccountHandler` pasa estos campos al RPC si vienen en el request.
- **`api/supabase/migrations/20260502120000_update_rpc_manual_override_pass_successes_drag_revenue.sql`**: RPC `update_current_account_recompute` acepta overrides manuales para `pass` (reemplaza cálculo desde tickets), `successes` (reemplaza premios desde tickets), `revenue` (reemplaza subtotal calculado), `drag` (reemplaza cálculo por fee_plus). Si no vienen en `p_props`, el comportamiento anterior se mantiene.
### Fixed - 2026-05-06

#### Archive tickets — jugadas no cargaban en terminal-ticket para tickets viejos

- **`api/src/bet/repository/bet.repository.ts`** — `getAllBets()`: Al buscar el `ticket_id` por `ticket_number`, ahora usa `getTableName(date, 'tickets')` para consultar `tickets_archive` cuando la fecha es antigua. Antes siempre consultaba `tickets`, retornando `null` para tickets archivados y por ende 0 jugadas. También cambia `.single()` por `.maybeSingle()` para evitar error cuando no existe.

### Fixed - 2026-05-06

#### Archive tickets — `bet_order` faltante en RPC y pago desde archivo

- **`api/supabase/migrations/20260506120000_fix_archive_rpc_bet_order.sql`**: Actualiza `ticket_full_json_plpgsql_archive` para incluir `bet_order` en cada bet del JSON (igual que la versión regular desde `20260102194200`). También alinea el `DISTINCT ON` a `(ticket_id, bet_order, schedule_id, lottery_id)`. Sin el `bet_order`, el modal de repetir ticket asignaba la clave `"undefined"` a todas las apuestas y solo guardaba la primera.
- **`api/supabase/migrations/20260506120001_add_pay_ticket_archive.sql`**: Nueva función `pay_ticket_archive(p_ticket_number TEXT, p_user_id UUID, p_organization_id UUID)`. Misma lógica que `pay_ticket` pero opera sobre `tickets_archive` y `bets_archive`. Permite pagar tickets ganadores archivados (> 2 días).
- **`api/src/ticket/repository/ticket.repository.ts`** — `payTicket()`: Si `pay_ticket` RPC lanza `TICKET_NOT_FOUND`, reintenta con `pay_ticket_archive` antes de propagar el error. Así el fallback es transparente para el caller.
- **`api/src/ticket/controller/ticket.controller.ts`** — `paid()`: Eliminado el try/catch roto que bloqueaba el pago de tickets archivados con error `TICKET_ARCHIVED`. El repository ahora maneja el fallback internamente.

### Added - 2026-04-30

#### Cuenta Corriente — recálculo en cascada de días posteriores

- **`api/supabase/migrations/20260430120000_rpc_cascade_current_account_from_date.sql`**: Nueva función `cascade_current_account_from_date(p_from_date_text TEXT, p_organization_id UUID, p_user_id UUID DEFAULT NULL)`. Cuando se actualiza un día pasado, propaga el nuevo `total` y `drag` hacia todos los días siguientes del usuario (o todos los usuarios de la org si `p_user_id` es NULL), actualizando `previous_balance`, `previous_drag`, `total`, `drag` y `leave` (si estaba calculado) en cascada.
- **`api/src/current-account/repository/current-account.repository.ts`**: Nuevo método `cascadeCurrentAccountFromDateHandler(organization_id, date?, user_id?)` que llama al RPC `cascade_current_account_from_date`.
- **`api/src/current-account/controller/current-account.controller.ts`**: `calculateCurrentAccountHandler` llama a cascade después de calcular (scope: todos los usuarios de la org). `updateCurrentAccountHandler` llama a cascade para el usuario específico cuyo registro fue editado. `calculateCurrentAccountNetworkHandler` llama a cascade para cada org en la red.
- **Why**: Al cargar reclamos, pagos o cobros de un día pasado (ej: viernes) en fecha posterior (ej: sábado), el `saldo anterior` del sábado quedaba desactualizado. Ahora cualquier modificación propaga automáticamente el nuevo saldo hacia los días siguientes.

### Fixed - 2026-04-23

#### Archive RPC — statement timeout + single-batch loop
- **`api/src/archive/service/archive.service.ts`**: `archiveOldData` now loops per date until `bets_remaining + tickets_remaining = 0`, passing `p_batch_size: 500` per call. Previous code called the RPC once per date with default batch 5000, which exceeded PostgREST's ~8 s statement timeout on large days.

#### Archive RPC — ambiguous function overload
- **`api/supabase/migrations/20260423061747_drop_archive_data_by_date_single_param.sql`**: Drops `archive_data_by_date(DATE)` left over from migration `20260415`. Migration `20260422` added a two-param overload `(DATE, INTEGER DEFAULT 5000)` with a different signature so Postgres kept both. RPC calls with only `p_date` got "could not choose best candidate function" error. Removing the old overload leaves only the batch-size version.

### Added - 2026-04-21

#### Org Expenses — soporte de grupo

- **`api/supabase/migrations/20260421095647_add_group_id_to_org_expenses.sql`**: Añade columna `group_id TEXT DEFAULT NULL` a `org_expenses`.
- **`api/src/org-expense/repository/org-expense.repository.ts`**: `getByOrgAndDate` filtra por `group_id` (o IS NULL si no se pasa). `create` acepta `group_id`.
- **`api/src/org-expense/controller/org-expense.controller.ts`**: Pasa `group_id` a repository en get y create.
- **`api/src/org-expense/route/org-expense.route.ts`**: Lee `group_id` de query (GET) y body (POST).

### Added - 2026-04-20

#### Cuenta Corriente — endpoint daily-summary
- **`api/src/current-account/repository/current-account.repository.ts`**: Added `getDailySummaryByDateRange` — queries `current_accounts` for all CC fields (pass, successes, claims, subtotal, previous_balance, collections, paid, total, drag, leave), aggregates per date.
- **`api/src/current-account/controller/current-account.controller.ts`**: Added `getDailySummaryByDateRangeHandler` delegating to repository.
- **`api/src/current-account/route/current-account.route.ts`**: Added `GET /daily-summary?date_from&date_to&group_id` — same auth/group scoping as `/totals`. Returns `{ data: { summary: DailySummaryEntry[] } }`.

### Fixed - 2026-04-20

#### Session Management
- **Version mismatch on login**: `signRefreshToken` at login now uses `refresh_token_version + 1` to match the version stored by `rotateRefreshToken`, fixing first-refresh 401 failures that caused users to be logged out every ~13-14 minutes (`api/src/auth/controller/auth.controller.ts`)

### Fixed - 2026-04-19

#### Concurrency and race condition hardening
- **`api/src/auth/controller/auth.controller.ts`**: Check `token_version` from JWT against DB before bcrypt hash comparison. Concurrent refreshes from multiple tabs no longer trigger false `token_reuse_detected` → `revokeAllUserSessions`. Also replaced TOCTOU `countActiveSessions + revokeOldestSession + create` with single `createWithLimit` RPC call.
- **`api/src/auth/repository/auth.repository.ts`**: Removed racy SELECT+UPDATE fallback in `incrementFailedAttempts`. Failed login count is now always atomic via the `increment_failed_attempts` RPC.
- **`api/src/session/cache/session-activity.cache.ts`**: Added `restore()` method for max-timestamp-wins re-merge.
- **`api/src/session/job/session-monitor.job.ts`**: Re-merge activity snapshot back to cache on DB flush failure — prevents mass session expiry on transient Supabase errors.
- **`api/src/session/repository/session.repository.ts`**: Added `createWithLimit()` using `create_session_with_limit` RPC for atomic concurrent-session enforcement.
- **`api/supabase/migrations/20260419100000`**: `batch_update_session_activity` now uses `GREATEST()` to prevent timestamp regression under concurrent flushes from multiple server instances.
- **`api/supabase/migrations/20260419100001`**: `pay_ticket` adds `SELECT ... FOR UPDATE` before UPDATE to serialize concurrent payment attempts and prevent double side-effects.
- **`api/supabase/migrations/20260419100002`**: `create_session_with_limit` RPC initial implementation (contained invalid `SELECT COUNT(*) ... FOR UPDATE` — fixed in 20260419192947).
- **`api/supabase/migrations/20260419192947`**: Fix `create_session_with_limit` — replace invalid `FOR UPDATE` on aggregate with `pg_advisory_xact_lock(hashtext('create_session:' || user_id))`. PostgreSQL does not allow `FOR UPDATE` with aggregate functions; advisory lock serializes concurrent logins for the same user atomically.
- **`api/supabase/migrations/20260419100003`**: `calculate_current_account` acquires `pg_advisory_xact_lock(org:date)` to serialize concurrent bulk liquidations from shared admin accounts.

### Fixed - 2026-04-18

#### Ticket number uniqueness scoped to organization + cashier number suffix
- **Root cause**: `UNIQUE (ticket_number)` was global — different organizations (or different cashiers in same org) creating tickets at the same millisecond caused false unique constraint violations.
- **Fix**: `ticket_number` generation in `api/src/ticket/helper/ticketBase.ts` now appends the cashier's `number` as suffix (e.g. `20260418143025123-42`), making same-org same-millisecond collisions impossible in practice.
- **`helper/request/ticket.request.ts`**: Added `user_number?: number | null` to `INewTicketEntity` — frontend sends cashier's number (handles case where admin creates on behalf of cashier: `cashier?.number ?? user!.number`).
- **`web/src/features/make-plays/provider/MakePlaysProvider.tsx`**: Both payloads include `user_number: cashier?.number ?? user!.number`.
- **`api/src/ticket/helper/ticketBase.ts`**: Uses `ticket.user_number` from the payload to build suffix with dash (format `YYYYMMDDHHmmssSSS-{N}`).
- **`api/supabase/migrations/20260418203053`**: Also drops `ticket_number_numeric_only` constraint and replaces it with `ticket_number_format CHECK (ticket_number ~ '^\d+(-\d+)?$')` to allow the dash-separated suffix.
- **`api/supabase/migrations/20260418203053_fix_unique_ticket_number_per_org.sql`**: Drops global constraint, adds `UNIQUE (ticket_number, organization_id)`.

### Added - 2026-04-16

#### Totales por rango de fechas en Cuenta Corriente
- **`api/src/current-account/repository/current-account.repository.ts`**: Nuevo método `getTotalsByDateRangeHandler(organization_id, date_from, date_to, user_ids?)` — query GROUP BY date sobre `current_accounts` dentro de un rango, con soporte de filtro por `user_ids` (grupos) y red de organizaciones
- **`api/src/current-account/controller/current-account.controller.ts`**: Nuevo método `getTotalsByDateRangeHandler` que delega al repositorio
- **`api/src/current-account/route/current-account.route.ts`**: Nuevo endpoint `GET /totals` con query params `date_from`, `date_to`, `group_id` (opcional). Auto-scope a grupo para ADMIN con grupo asignado. Acceso: todos excepto CASHIER

### Fixed - 2026-04-15

#### Ticket lookup always returning NOT_FOUND
- **Root cause**: `TicketController.get` checked `ticket.organization_id !== organization_id` after calling `repository.getById`, but neither `ticket_full_json_plpgsql` nor `ticket_full_json_plpgsql_archive` include `organization_id` in their JSONB output. So `ticket.organization_id` was always `undefined`, the check always failed, and every ticket ID lookup returned "Ticket no encontrado".
- **Fix**: Removed the redundant check in `api/src/ticket/controller/ticket.controller.ts`. Both RPCs already filter `WHERE ticket_id = p_ticket_id AND organization_id = p_organization_id` in SQL, so any result is already scoped to the correct org.
- **Introduced by**: commit `9a4a007` (feat: implement smart archive query routing system)

### Changed - 2026-04-15

#### Archive job: day-by-day processing
- **Root cause fixed**: archive job was failing because a single `archive_old_data` SP call processed 1.2M+ rows in one transaction, hitting Supabase's `statement_timeout`. The TS fallback also failed because `.delete().in('bet_id', ids)` with 5000 UUIDs exceeded HTTP URL length limits.
- **New approach**: TypeScript fetches distinct dates to archive (`get_dates_to_archive` RPC), then loops oldest-to-newest calling `archive_data_by_date(date)` per day. Each call is scoped to one day's data so it never approaches the timeout.
- **New migration** `20260415080624_archive_by_date.sql`:
  - Drops `archive_old_bets(INTEGER)`, `archive_old_tickets(INTEGER)`, `archive_old_data(INTEGER)`
  - Adds `get_dates_to_archive(p_cutoff_date DATE)` — returns `DATE[]` of distinct dates with data before the cutoff
  - Adds `archive_data_by_date(p_date DATE)` — archives bets then tickets for that date in one transaction, returns `{date, bets_archived, tickets_archived}`
- **`archive.service.ts`**: rewrote `archiveOldData` to loop by day with per-day try/catch; breaks on first failure and reports which date failed. Removed TS manual fallback (`archiveOldBetsManual`, `archiveOldTicketsManual`, `archiveOldDataManual`).
- **`cron.service.ts`**: updated result logging to show per-day breakdown and totals.

### Added - 2026-04-14

#### Ticket Idempotency
- **client_request_id column**: Added nullable UUID column with partial unique index to `tickets` table (`migrations/20260414090510_add_client_request_id_to_tickets.sql`)
- **RPC update**: `create_ticket_with_bets` now accepts optional `p_client_request_id UUID` — returns existing ticket on duplicate key using `ON CONFLICT ... DO NOTHING` instead of inserting again (`migrations/20260414090511_sp_create_ticket_idempotency.sql`)
- **Repository**: `TicketRepository.create` passes `p_client_request_id` to the RPC
