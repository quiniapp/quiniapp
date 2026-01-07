-- Migration: Update constraints and migrate SUPERADMIN to CAPITALIST (Part 2 of 2)
--
-- This migration runs AFTER the enum value is added in the previous migration.
-- It updates constraints to include CAPITALIST and migrates existing data.

-- Step 1: Drop ALL existing constraints related to user_type
-- Note: 'users_check' is the auto-generated name for the inline CHECK in create-user-model.sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS user_type_fields_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS user_number_type_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_number_required_for_admin_cashier;

-- Step 2: Recreate cashier fields constraint with CAPITALIST included
ALTER TABLE users ADD CONSTRAINT user_type_fields_check CHECK (
  -- CASHIER must have cashier_type, fee, and fee_plus
  (user_type = 'CASHIER' AND cashier_type IS NOT NULL AND fee IS NOT NULL AND fee_plus IS NOT NULL)
  OR
  -- OWNER, CAPITALIST, SUPERADMIN, and ADMIN must NOT have cashier fields
  (user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN', 'ADMIN') AND cashier_type IS NULL AND fee IS NULL AND fee_plus IS NULL)
);

-- Step 3: Recreate number constraint with CAPITALIST included
-- This replaces the old check_number_required_for_admin_cashier constraint
ALTER TABLE users ADD CONSTRAINT check_number_required_for_admin_cashier CHECK (
  -- ADMIN and CASHIER must have a number
  (user_type IN ('ADMIN', 'CASHIER') AND number IS NOT NULL)
  OR
  -- OWNER, CAPITALIST, and SUPERADMIN can have NULL number
  (user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN'))
);

-- Step 4: Migrate existing SUPERADMIN users to CAPITALIST
-- These are the organization-level admins that should become CAPITALIST
UPDATE users
SET user_type = 'CAPITALIST'
WHERE user_type = 'SUPERADMIN';

-- Add comment for documentation
COMMENT ON TYPE user_type IS 'User hierarchy: OWNER (system owner) -> CAPITALIST (org owner) -> SUPERADMIN (group admin) -> ADMIN (limited admin) -> CASHIER (cashier/pasador)';
