-- Migration: Make user number conditionally nullable
-- Date: 2025-12-15
-- Description: Allow OWNER and SUPERADMIN users to have NULL numbers,
--              while keeping number required for ADMIN and CASHIER users.
--              Number uniqueness is scoped per organization.

-- Step 1: Make the number column nullable FIRST
-- This allows us to set NULL values in the next step
ALTER TABLE users
ALTER COLUMN number DROP NOT NULL;

-- Step 2: Update existing OWNER/SUPERADMIN users to have NULL numbers
-- This prevents constraint violations when we add the new CHECK constraint
UPDATE users
SET number = NULL
WHERE user_type IN ('SUPERADMIN', 'OWNER')
  AND deleted_at IS NULL;

-- Step 3: Drop existing partial unique index
DROP INDEX IF EXISTS unique_number_when_not_deleted;

-- Step 4: Create new partial unique index that handles NULLs properly
-- Scoped by organization_id so each organization can have its own user #1, #2, etc.
-- Only applies when number is NOT NULL (PostgreSQL allows multiple NULLs)
CREATE UNIQUE INDEX unique_number_when_not_null_and_not_deleted
ON users (number, organization_id)
WHERE number IS NOT NULL AND deleted_at IS NULL;

-- Step 5: Add CHECK constraint to enforce conditional nullability rules
ALTER TABLE users
ADD CONSTRAINT check_number_required_for_admin_cashier
CHECK (
  -- ADMIN and CASHIER must have a non-null number
  (user_type IN ('ADMIN', 'CASHIER') AND number IS NOT NULL)
  OR
  -- OWNER and SUPERADMIN can have NULL number
  (user_type IN ('OWNER', 'SUPERADMIN'))
);
