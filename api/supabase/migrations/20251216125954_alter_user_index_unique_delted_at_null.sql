-- Migration: Rollback username to global unique
-- Date: 2025-12-16
-- Description: Revert username uniqueness back to global scope.
--              Username must be globally unique for login to work properly.
--              This rollback reverts the per-organization username uniqueness
--              because login authentication requires identifying users by username alone.

-- Step 1: Drop the per-organization unique index
DROP INDEX IF EXISTS unique_username_per_org_when_active;

-- Step 2: Recreate the global unique index for active users
CREATE UNIQUE INDEX unique_username_not_deleted
ON users (username)
WHERE deleted_at IS NULL;

-- Comment for documentation
COMMENT ON INDEX unique_username_not_deleted
IS 'Ensures usernames are globally unique among active (non-deleted) users. Required for login authentication to work properly.';
