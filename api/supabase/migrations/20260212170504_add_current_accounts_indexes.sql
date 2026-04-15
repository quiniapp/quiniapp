-- ============================================================================
-- Migration: Add missing indexes to current_accounts table
-- ============================================================================
-- Problem: calculate_current_account is doing full table scans
-- Root cause: Missing indexes on current_accounts for common query patterns
-- Impact: Timeout errors when calculating current accounts for dates with
--         large number of historical records (1M+ rows)
-- ============================================================================

-- ============================================================================
-- 1. Add index for previous_state query (most expensive)
-- ============================================================================
-- Query pattern:
--   SELECT ... FROM current_accounts ca
--   WHERE ca.date < v_date
--     AND ca.organization_id = p_organization_id
--   ORDER BY ca.user_id, ca.date DESC
--
-- This query scans ALL historical records to find the most recent state
-- for each user before the target date. Without an index, it's a full scan.

CREATE INDEX IF NOT EXISTS idx_current_accounts_org_user_date_desc
  ON current_accounts(organization_id, user_id, date DESC);

COMMENT ON INDEX idx_current_accounts_org_user_date_desc IS
'Optimizes previous_state query in calculate_current_account.
Allows efficient lookup of most recent balance per user before a given date.';

-- ============================================================================
-- 2. Add index for existing_day query
-- ============================================================================
-- Query pattern:
--   SELECT ... FROM current_accounts ca
--   WHERE ca.date = v_date
--     AND ca.organization_id = p_organization_id
--
-- This query looks up existing records for the target date.
-- Without an index, it scans the entire table.

CREATE INDEX IF NOT EXISTS idx_current_accounts_date_org
  ON current_accounts(date, organization_id);

COMMENT ON INDEX idx_current_accounts_date_org IS
'Optimizes existing_day query in calculate_current_account.
Allows efficient lookup of current account records for a specific date.';

-- ============================================================================
-- 3. Add composite index for user-specific queries
-- ============================================================================
-- Some queries filter by user_id first, then date.
-- This index helps with user-specific account history lookups.

CREATE INDEX IF NOT EXISTS idx_current_accounts_user_date_desc
  ON current_accounts(user_id, date DESC);

COMMENT ON INDEX idx_current_accounts_user_date_desc IS
'Optimizes user-specific account history queries.
Useful for fetching user balance history in descending date order.';

-- ============================================================================
-- 4. Update table statistics
-- ============================================================================
-- After creating indexes, update statistics so the query planner
-- knows about them and can make optimal execution plans.

ANALYZE current_accounts;

-- ============================================================================
-- 5. Verification
-- ============================================================================

DO $$
DECLARE
  v_indexes_count INT;
  v_table_rows BIGINT;
BEGIN
  -- Count new indexes on current_accounts
  SELECT COUNT(*) INTO v_indexes_count
  FROM pg_indexes
  WHERE tablename = 'current_accounts'
    AND indexname LIKE 'idx_current_accounts_%';

  -- Get approximate row count
  SELECT reltuples::BIGINT INTO v_table_rows
  FROM pg_class
  WHERE relname = 'current_accounts';

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Current Accounts Indexes Added';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Total indexes on current_accounts: %', v_indexes_count;
  RAISE NOTICE 'Approximate table size: % rows', v_table_rows;
  RAISE NOTICE '================================================';
  RAISE NOTICE 'New indexes:';
  RAISE NOTICE '1. idx_current_accounts_org_user_date_desc';
  RAISE NOTICE '   → Optimizes previous_state (most expensive query)';
  RAISE NOTICE '2. idx_current_accounts_date_org';
  RAISE NOTICE '   → Optimizes existing_day lookup';
  RAISE NOTICE '3. idx_current_accounts_user_date_desc';
  RAISE NOTICE '   → Optimizes user-specific history queries';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Expected improvements:';
  RAISE NOTICE '- previous_state: Full scan → Index scan (100x-1000x faster)';
  RAISE NOTICE '- existing_day: Full scan → Index scan (100x-1000x faster)';
  RAISE NOTICE '- Overall calculate_current_account: Should complete in <1s';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test calculate_current_account performance';
  RAISE NOTICE '2. Monitor query execution plans with EXPLAIN ANALYZE';
  RAISE NOTICE '3. If still slow, consider partitioning current_accounts';
  RAISE NOTICE '================================================';
END $$;
