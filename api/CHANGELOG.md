# Changelog

All notable changes to the API workspace are documented in this file.

## [Unreleased]

### Fixed - 2026-04-19

#### Concurrency and race condition hardening
- **`api/src/auth/controller/auth.controller.ts`**: Check `token_version` from JWT against DB before bcrypt hash comparison. Concurrent refreshes from multiple tabs no longer trigger false `token_reuse_detected` → `revokeAllUserSessions`. Also replaced TOCTOU `countActiveSessions + revokeOldestSession + create` with single `createWithLimit` RPC call.
- **`api/src/auth/repository/auth.repository.ts`**: Removed racy SELECT+UPDATE fallback in `incrementFailedAttempts`. Failed login count is now always atomic via the `increment_failed_attempts` RPC.
- **`api/src/session/cache/session-activity.cache.ts`**: Added `restore()` method for max-timestamp-wins re-merge.
- **`api/src/session/job/session-monitor.job.ts`**: Re-merge activity snapshot back to cache on DB flush failure — prevents mass session expiry on transient Supabase errors.
- **`api/src/session/repository/session.repository.ts`**: Added `createWithLimit()` using `create_session_with_limit` RPC for atomic concurrent-session enforcement.
- **`api/supabase/migrations/20260419100000`**: `batch_update_session_activity` now uses `GREATEST()` to prevent timestamp regression under concurrent flushes from multiple server instances.
- **`api/supabase/migrations/20260419100001`**: `pay_ticket` adds `SELECT ... FOR UPDATE` before UPDATE to serialize concurrent payment attempts and prevent double side-effects.
- **`api/supabase/migrations/20260419100002`**: `create_session_with_limit` RPC atomically enforces concurrent session limit using `FOR UPDATE` lock on session count — eliminates TOCTOU race.
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
