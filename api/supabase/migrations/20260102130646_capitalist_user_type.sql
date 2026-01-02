-- Migration: Add CAPITALIST to user_type enum (Part 1 of 2)
--
-- IMPORTANT: This migration ONLY adds the enum value.
-- The constraints and data migration are in the NEXT migration file
-- because PostgreSQL cannot use a new enum value in the same transaction.
--
-- Hierarchy: OWNER -> CAPITALIST -> SUPERADMIN -> ADMIN -> CASHIER

ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'CAPITALIST' BEFORE 'SUPERADMIN';

