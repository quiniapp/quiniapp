-- Migration: Make organization name unique only for active organizations
-- Date: 2025-12-16
-- Description: Change organization name UNIQUE constraint to a partial unique index
--              that only applies when deleted_at IS NULL. This allows reusing names
--              for deleted organizations.

-- Step 1: Drop the existing UNIQUE constraint on name
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_name_key;

-- Step 2: Create a partial unique index that only applies to active organizations
-- This allows deleted organizations to have duplicate names with active ones
CREATE UNIQUE INDEX unique_organization_name_when_active
ON organizations (name)
WHERE deleted_at IS NULL;

-- Comment for documentation
COMMENT ON INDEX unique_organization_name_when_active IS 'Ensures organization names are unique among active (non-deleted) organizations only. Allows name reuse after soft delete.';
