-- Add performance indexes for schedule_lotteries table
-- These indexes optimize common query patterns

-- Index for faster deletes by organization_id, day, and schedule_id
-- Used by the save_schedule_lottery RPC function
CREATE INDEX IF NOT EXISTS idx_schedule_lotteries_org_day_schedule
  ON schedule_lotteries (organization_id, day, schedule_id);

-- Index for filtering by organization_id and day
-- Used when fetching lotteries/schedules for a specific day
CREATE INDEX IF NOT EXISTS idx_schedule_lotteries_org_day
  ON schedule_lotteries (organization_id, day);

-- Index for filtering by organization_id and schedule_id
-- Used when fetching lotteries for a specific schedule
CREATE INDEX IF NOT EXISTS idx_schedule_lotteries_org_schedule
  ON schedule_lotteries (organization_id, schedule_id);

-- Add comments explaining the indexes
COMMENT ON INDEX idx_schedule_lotteries_org_day_schedule IS
  'Optimizes delete operations in save_schedule_lottery RPC function';

COMMENT ON INDEX idx_schedule_lotteries_org_day IS
  'Optimizes queries filtering by organization and day';

COMMENT ON INDEX idx_schedule_lotteries_org_schedule IS
  'Optimizes queries filtering by organization and schedule';
