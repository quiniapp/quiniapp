-- Performance index fixes:
-- 1. Drop duplicate index on results (both cover same columns, keep idx_results_schedule_date)
-- 2. Add missing covering indexes for unindexed foreign keys
-- 3. Drop unused indexes on auth_audit_log (write-heavy table — fewer indexes = faster inserts)

-- 1. Drop duplicate
DROP INDEX IF EXISTS public.idx_results_schedule_id_date;

-- 2. Missing FK indexes
CREATE INDEX IF NOT EXISTS idx_schedule_lotteries_lottery_id
  ON public.schedule_lotteries(lottery_id);

CREATE INDEX IF NOT EXISTS idx_schedule_lotteries_schedule_id
  ON public.schedule_lotteries(schedule_id);

CREATE INDEX IF NOT EXISTS idx_ticket_prizes_by_turn_schedule_id
  ON public.ticket_prizes_by_turn(schedule_id);

CREATE INDEX IF NOT EXISTS idx_tickets_deleted_by
  ON public.tickets(deleted_by);

CREATE INDEX IF NOT EXISTS idx_bets_archive_lottery_id
  ON public.bets_archive(lottery_id);

CREATE INDEX IF NOT EXISTS idx_bets_archive_user_id
  ON public.bets_archive(user_id);

-- 3. Unused indexes on auth_audit_log
DROP INDEX IF EXISTS public.idx_audit_user_id;
DROP INDEX IF EXISTS public.idx_audit_session_id;
DROP INDEX IF EXISTS public.idx_audit_event_type;
DROP INDEX IF EXISTS public.idx_audit_created_at;
DROP INDEX IF EXISTS public.idx_audit_ip_address;
DROP INDEX IF EXISTS public.idx_audit_username;
DROP INDEX IF EXISTS public.idx_audit_failed_logins;
