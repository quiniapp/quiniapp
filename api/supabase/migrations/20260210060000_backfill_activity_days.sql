-- ============================================================================
-- Migration: Backfill activity_days table with historical data
-- ============================================================================
-- This migration populates the activity_days table with all historical dates
-- that have bets or tickets, so the archive system can determine which data
-- to archive based on actual activity.
-- ============================================================================

-- Insert all unique dates from bets table
INSERT INTO activity_days (date, has_activity, bets_count, tickets_count, created_at, updated_at)
SELECT
  date,
  true as has_activity,
  COUNT(*) as bets_count,
  0 as tickets_count,
  NOW() as created_at,
  NOW() as updated_at
FROM bets
WHERE deleted_at IS NULL
GROUP BY date
ON CONFLICT (date)
DO UPDATE SET
  bets_count = EXCLUDED.bets_count,
  has_activity = true,
  updated_at = NOW();

-- Update tickets count for each date
UPDATE activity_days ad
SET
  tickets_count = t.count,
  updated_at = NOW()
FROM (
  SELECT date, COUNT(*) as count
  FROM tickets
  WHERE deleted_at IS NULL
  GROUP BY date
) t
WHERE ad.date = t.date;

-- Verify results
DO $$
DECLARE
  total_days INTEGER;
  active_days INTEGER;
  oldest_date DATE;
  newest_date DATE;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE has_activity = true),
         MIN(date),
         MAX(date)
  INTO total_days, active_days, oldest_date, newest_date
  FROM activity_days;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Activity Days Backfill Complete';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Total days in activity_days: %', total_days;
  RAISE NOTICE 'Days with activity: %', active_days;
  RAISE NOTICE 'Oldest date: %', oldest_date;
  RAISE NOTICE 'Newest date: %', newest_date;
  RAISE NOTICE '================================================';
END $$;
