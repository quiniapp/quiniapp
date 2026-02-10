-- ============================================================================
-- Migration: Fix generate_winners timeout issues
-- ============================================================================
-- Increases statement_timeout for generate_winners functions and adds
-- missing indexes to improve query performance
-- ============================================================================

-- ============================================================================
-- 1. Increase statement_timeout for generate_winners functions
-- ============================================================================

-- Main function: generate_winners_and_calculate_accounts
-- Set timeout to 5 minutes (300 seconds)
ALTER FUNCTION generate_winners_and_calculate_accounts(UUID, DATE, UUID)
SET statement_timeout = '300000';  -- 5 minutes in milliseconds

COMMENT ON FUNCTION generate_winners_and_calculate_accounts IS
'Generates winners and calculates current accounts. Heavy operation with 5-minute timeout.';

-- ============================================================================
-- 2. Add missing indexes for better query performance
-- ============================================================================

-- Index for bets lookup by schedule_id, date, organization_id
-- Used heavily in generate_winners WHERE clause
CREATE INDEX IF NOT EXISTS idx_bets_schedule_date_org_active
  ON bets(schedule_id, date, organization_id)
  WHERE deleted_at IS NULL;

-- Index for results lookup in generate_winners JOIN
CREATE INDEX IF NOT EXISTS idx_results_lottery_schedule_date_org_active
  ON results(lottery_id, schedule_id, date, organization_id)
  WHERE deleted_at IS NULL;

-- Index for ticket_prizes_by_turn lookups
CREATE INDEX IF NOT EXISTS idx_ticket_prizes_date_schedule_org
  ON ticket_prizes_by_turn(date, schedule_id, organization_id);

-- Index for tickets update lookup
CREATE INDEX IF NOT EXISTS idx_tickets_date_org_active
  ON tickets(date, organization_id)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. Add same indexes to archive tables (for consistency)
-- ============================================================================

-- Archive bets index
CREATE INDEX IF NOT EXISTS idx_bets_archive_schedule_date_org_active
  ON bets_archive(schedule_id, date, organization_id)
  WHERE deleted_at IS NULL;

-- Archive tickets index
CREATE INDEX IF NOT EXISTS idx_tickets_archive_date_org_active
  ON tickets_archive(date, organization_id)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. Analyze tables to update statistics
-- ============================================================================

ANALYZE bets;
ANALYZE tickets;
ANALYZE results;
ANALYZE ticket_prizes_by_turn;
ANALYZE bets_archive;
ANALYZE tickets_archive;

-- ============================================================================
-- 5. Verification
-- ============================================================================

DO $$
DECLARE
  v_timeout TEXT;
  v_indexes_count INT;
BEGIN
  -- Check timeout setting
  SELECT proconfig::text INTO v_timeout
  FROM pg_proc
  WHERE proname = 'generate_winners_and_calculate_accounts'
    AND pronargs = 3;

  -- Count new indexes
  SELECT COUNT(*) INTO v_indexes_count
  FROM pg_indexes
  WHERE indexname LIKE 'idx_%'
    AND (tablename = 'bets' OR tablename = 'tickets' OR tablename = 'results'
         OR tablename = 'ticket_prizes_by_turn' OR tablename = 'bets_archive'
         OR tablename = 'tickets_archive');

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Generate Winners Timeout Fix Applied';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Function timeout config: %', COALESCE(v_timeout, 'default');
  RAISE NOTICE 'Total indexes on related tables: %', v_indexes_count;
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test generate_winners on recent date (should be faster)';
  RAISE NOTICE '2. Monitor query performance';
  RAISE NOTICE '3. If still slow, consider RPC refactoring';
  RAISE NOTICE '================================================';
END $$;
