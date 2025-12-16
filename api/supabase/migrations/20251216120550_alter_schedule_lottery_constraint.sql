-- Migration: Make schedule_lottery unique constraint scoped by organization
-- Date: 2025-12-16
-- Description: Update unique_schedule_lottery_day constraint to include organization_id.
--              This allows each organization to have its own independent lottery schedules
--              without conflicts with other organizations.

-- Step 1: Drop the existing global unique constraint
ALTER TABLE schedule_lotteries
DROP CONSTRAINT IF EXISTS unique_schedule_lottery_day;

-- Step 2: Create new unique constraint scoped by organization
-- Each organization can now have its own lottery schedules independently
ALTER TABLE schedule_lotteries
ADD CONSTRAINT unique_schedule_lottery_day_per_org
UNIQUE (organization_id, schedule_id, lottery_id, day);

-- Comment for documentation
COMMENT ON CONSTRAINT unique_schedule_lottery_day_per_org ON schedule_lotteries
IS 'Ensures schedule-lottery-day combinations are unique per organization. Allows different organizations to have the same schedule configurations.';
