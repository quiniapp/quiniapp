-- Migration: Make username unique per organization
-- Date: 2025-12-16
-- Description: Change username uniqueness from global to per-organization scope.
--              This allows different organizations to have users with the same username.
--              Only applies to active (non-deleted) users.

-- Step 1: Drop the existing global unique index
DROP INDEX IF EXISTS unique_username_not_deleted;

-- Step 2: Create new partial unique index scoped by organization
-- This allows each organization to have its own "admin", "gaston", etc.
CREATE UNIQUE INDEX unique_username_per_org_when_active
ON users (organization_id, username)
WHERE deleted_at IS NULL;

-- Comment for documentation
COMMENT ON INDEX unique_username_per_org_when_active
IS 'Ensures usernames are unique per organization among active users. Allows different organizations to have users with the same username (e.g., multiple "admin" users across organizations).';
