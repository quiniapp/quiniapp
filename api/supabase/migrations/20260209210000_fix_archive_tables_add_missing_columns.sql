-- ============================================================================
-- Migration: Add missing columns to archive tables
-- ============================================================================
-- This migration adds columns that were added to main tables after
-- the archive tables were created, ensuring schema parity
-- ============================================================================

-- Add missing columns to bets_archive
ALTER TABLE bets_archive ADD COLUMN IF NOT EXISTS prize NUMERIC DEFAULT 0;
ALTER TABLE bets_archive ADD COLUMN IF NOT EXISTS ticket_number TEXT;
ALTER TABLE bets_archive ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT '';
ALTER TABLE bets_archive ADD COLUMN IF NOT EXISTS bet_order INTEGER DEFAULT 0;
ALTER TABLE bets_archive ADD COLUMN IF NOT EXISTS hits INTEGER DEFAULT 0;
ALTER TABLE bets_archive ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Add missing columns to tickets_archive (if any)
ALTER TABLE tickets_archive ADD COLUMN IF NOT EXISTS total_prize NUMERIC DEFAULT 0;
ALTER TABLE tickets_archive ADD COLUMN IF NOT EXISTS hits INTEGER DEFAULT 0;
ALTER TABLE tickets_archive ADD COLUMN IF NOT EXISTS organization_id UUID;
