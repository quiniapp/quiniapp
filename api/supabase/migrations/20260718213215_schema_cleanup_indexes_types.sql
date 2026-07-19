-- Schema cleanup (schema audit 2026-07-18, part 2)
-- Follow-up to 20260718153406_security_hardening_revoke_grants.sql:
-- 1. Drop redundant indexes (exact duplicates, prefixes of wider indexes,
--    low-selectivity booleans) — reduces write amplification on hot tables
-- 2. Type consistency: schedules timestamps -> timestamptz, prize columns
--    -> numeric(12,2)
-- 3. Drop legacy users.password column (guarded: aborts if it holds data)
-- 4. Fix hard_delete_organization: it failed on orgs with expenses
--    (fk_org_expenses_organization is ON DELETE RESTRICT) and left orphan
--    rows in the archive tables

------------------------------------------------------------------------------
-- 1) Redundant indexes
------------------------------------------------------------------------------

-- Exact duplicate of the index backing UNIQUE constraint
-- sessions_refresh_token_hash_key
DROP INDEX IF EXISTS public.idx_sessions_refresh_token_hash;

-- Duplicates of the primary keys
DROP INDEX IF EXISTS public.idx_bets_archive_bet_id;
DROP INDEX IF EXISTS public.idx_tickets_archive_ticket_id;

-- Prefixes of wider composite indexes (queries filtering deleted_at IS NULL
-- are served by the *_org_active partial indexes; all app queries do)
DROP INDEX IF EXISTS public.idx_bets_schedule_date;        -- covered by idx_bets_schedule_date_org_active
DROP INDEX IF EXISTS public.idx_bets_organization_id;      -- covered by idx_bets_org_date_active
DROP INDEX IF EXISTS public.idx_bets_user_id;              -- covered by idx_bets_user_date_deleted
DROP INDEX IF EXISTS public.idx_tpt_date;                  -- covered by idx_ticket_prizes_date_schedule_org
DROP INDEX IF EXISTS public.idx_tpt_date_schedule;         -- covered by idx_ticket_prizes_date_schedule_org
DROP INDEX IF EXISTS public.idx_schedule_lotteries_org_day;        -- covered by idx_schedule_lotteries_org_day_schedule
DROP INDEX IF EXISTS public.idx_schedule_lotteries_organization_id; -- covered by unique_schedule_lottery_day_per_org
DROP INDEX IF EXISTS public.idx_schedule_lotteries_org_schedule;    -- covered by unique_schedule_lottery_day_per_org
DROP INDEX IF EXISTS public.idx_results_lottery_id;        -- covered by idx_lottery_results_lottery_id_date
DROP INDEX IF EXISTS public.idx_results_schedule_id;       -- covered by idx_results_schedule_date

-- Overlaps the partial UNIQUE index unique_username_not_deleted
-- (username WHERE deleted_at IS NULL); the extra disabled=false predicate
-- does not change the access path for login lookups
DROP INDEX IF EXISTS public.idx_users_username_active;

-- Low-selectivity boolean indexes, never useful to the planner
DROP INDEX IF EXISTS public.idx_bets_paid;
DROP INDEX IF EXISTS public.idx_sessions_is_active;        -- indexes a constant (WHERE is_active = true)

------------------------------------------------------------------------------
-- 2) Type consistency
------------------------------------------------------------------------------

-- schedules used timestamp WITHOUT time zone; every other table uses
-- timestamptz. Existing values were written by CURRENT_TIMESTAMP on a UTC
-- server, so reinterpret them as UTC.
ALTER TABLE public.schedules
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN edited_at TYPE timestamptz USING edited_at AT TIME ZONE 'UTC',
  ALTER COLUMN edited_at SET DEFAULT now();

-- prize/total_prize were bare numeric; all other money columns are
-- numeric(12,2). Payouts are always 2-decimal money values.
ALTER TABLE public.bets
  ALTER COLUMN prize TYPE numeric(12,2);
ALTER TABLE public.bets_archive
  ALTER COLUMN prize TYPE numeric(12,2);
ALTER TABLE public.tickets
  ALTER COLUMN total_prize TYPE numeric(12,2);
ALTER TABLE public.tickets_archive
  ALTER COLUMN total_prize TYPE numeric(12,2);

------------------------------------------------------------------------------
-- 3) Drop legacy users.password (replaced by password_hash long ago; the API
--    only reads/writes password_hash). Guard: abort if any row still holds a
--    value, so we never destroy data silently.
------------------------------------------------------------------------------
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.users
  WHERE password IS NOT NULL AND password <> '';

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'users.password still holds % non-empty value(s). Migrate them to password_hash before dropping the column.',
      v_count;
  END IF;

  ALTER TABLE public.users DROP COLUMN password;
END;
$$;

------------------------------------------------------------------------------
-- 4) hard_delete_organization: delete org_expenses (ON DELETE RESTRICT made
--    the org DELETE fail) and clean up archive rows (organization_id has no
--    FK there, so they were left orphaned).
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hard_delete_organization(p_org_id uuid)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Child tables first (most dependent)
  DELETE FROM public.ticket_prizes_by_turn
   WHERE organization_id = p_org_id;

  DELETE FROM public.bets
   WHERE organization_id = p_org_id;

  DELETE FROM public.tickets
   WHERE organization_id = p_org_id;

  -- Archive tables: no FK on organization_id, delete explicitly
  DELETE FROM public.bets_archive
   WHERE organization_id = p_org_id;

  DELETE FROM public.tickets_archive
   WHERE organization_id = p_org_id;

  DELETE FROM public.current_accounts
   WHERE organization_id = p_org_id;

  DELETE FROM public.results
   WHERE organization_id = p_org_id;

  -- org_expenses FK is ON DELETE RESTRICT: must be deleted before the org
  DELETE FROM public.org_expenses
   WHERE organization_id = p_org_id;

  DELETE FROM public.schedule_lotteries
   WHERE organization_id = p_org_id;

  DELETE FROM public.schedules
   WHERE organization_id = p_org_id;

  DELETE FROM public.lotteries
   WHERE organization_id = p_org_id;

  -- Users whose group was this org: reset group_id to their organization_id
  -- (convention: "no group" = group_id equals organization_id)
  UPDATE public.users
     SET group_id = organization_id, edited_at = now()
   WHERE group_id = p_org_id
     AND organization_id != p_org_id;

  -- Delete users whose organization_id IS this org (root org deletion).
  -- Their sessions cascade via fk_sessions_user; auth_audit_log rows are
  -- kept with user_id/organization_id set to NULL (ON DELETE SET NULL).
  DELETE FROM public.users
   WHERE organization_id = p_org_id;

  -- Delete the organization itself
  DELETE FROM public.organizations
   WHERE organization_id = p_org_id;
END;
$$;
