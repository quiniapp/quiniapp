-- ============================================================================
-- Migration: Fix schema mismatches between bets and bets_archive
-- ============================================================================
-- Problem 1: ticket_number is INTEGER in archive but TEXT in main
-- Problem 2: Other column type mismatches
-- ============================================================================

-- ============================================================================
-- 1. Fix ticket_number type (INTEGER → TEXT)
-- ============================================================================

-- Change ticket_number from INTEGER to TEXT in bets_archive
ALTER TABLE bets_archive
ALTER COLUMN ticket_number TYPE TEXT
USING ticket_number::TEXT;

-- Also update tickets_archive if needed
DO $$
BEGIN
  -- Check if tickets_archive.ticket_number is also INTEGER
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tickets_archive'
      AND column_name = 'ticket_number'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE tickets_archive
    ALTER COLUMN ticket_number TYPE TEXT
    USING ticket_number::TEXT;

    RAISE NOTICE 'Updated tickets_archive.ticket_number: INTEGER → TEXT';
  END IF;
END $$;

-- ============================================================================
-- 2. Ensure all columns match between main and archive tables
-- ============================================================================

-- Get main bets table schema and apply to archive
DO $$
DECLARE
  v_column RECORD;
BEGIN
  FOR v_column IN
    SELECT
      c_main.column_name,
      c_main.data_type as main_type,
      c_archive.data_type as archive_type
    FROM information_schema.columns c_main
    LEFT JOIN information_schema.columns c_archive
      ON c_archive.table_name = 'bets_archive'
      AND c_archive.column_name = c_main.column_name
    WHERE c_main.table_name = 'bets'
      AND c_main.column_name NOT IN ('archived_at')  -- Skip archive-only columns
      AND (c_archive.data_type IS NULL OR c_main.data_type != c_archive.data_type)
  LOOP
    RAISE NOTICE 'Column mismatch: % (main: %, archive: %)',
      v_column.column_name,
      v_column.main_type,
      COALESCE(v_column.archive_type, 'MISSING');
  END LOOP;
END $$;

-- ============================================================================
-- 3. Verification
-- ============================================================================

DO $$
DECLARE
  v_main_type TEXT;
  v_archive_type TEXT;
BEGIN
  -- Check ticket_number types
  SELECT data_type INTO v_main_type
  FROM information_schema.columns
  WHERE table_name = 'bets'
    AND column_name = 'ticket_number';

  SELECT data_type INTO v_archive_type
  FROM information_schema.columns
  WHERE table_name = 'bets_archive'
    AND column_name = 'ticket_number';

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Schema Mismatch Fix Applied';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'ticket_number types:';
  RAISE NOTICE '  - bets: %', v_main_type;
  RAISE NOTICE '  - bets_archive: %', v_archive_type;

  IF v_main_type = v_archive_type THEN
    RAISE NOTICE '  - ✅ Types match!';
  ELSE
    RAISE WARNING '  - ❌ Types still mismatch!';
  END IF;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Next: Archive operation should work without type errors';
  RAISE NOTICE '================================================';
END $$;
