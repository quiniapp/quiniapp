-- ============================================================================
-- Migration: Fix bets_archive constraints to match main bets table
-- ============================================================================
-- Problem: bets_archive has outdated constraints from Feb 2026
--          Main bets table was updated in Jun 2025 to require length=10 for BORRATINA
--          Archive still expects length=8, causing archiving to fail
-- ============================================================================

-- ============================================================================
-- 1. Drop old constraints from bets_archive
-- ============================================================================

ALTER TABLE bets_archive DROP CONSTRAINT IF EXISTS chk_archive_number_allowed_lengths;
ALTER TABLE bets_archive DROP CONSTRAINT IF EXISTS chk_archive_borratina_number_with_length;
ALTER TABLE bets_archive DROP CONSTRAINT IF EXISTS chk_archive_redouble_number_with_length;
ALTER TABLE bets_archive DROP CONSTRAINT IF EXISTS chk_archive_position_valid_for_place;
ALTER TABLE bets_archive DROP CONSTRAINT IF EXISTS chk_archive_with_and_position_dependency;
ALTER TABLE bets_archive DROP CONSTRAINT IF EXISTS chk_archive_redouble_requires_with_position;

-- ============================================================================
-- 2. Update existing BORRATINA records in archive (if any) to length 10
-- ============================================================================

-- Pad existing 8-character borratina numbers to 10 characters
-- This makes them compatible with the new constraint
UPDATE bets_archive
SET bet_number = LPAD(bet_number, 10, '0')
WHERE bet_type = 'BORRATINA'
  AND char_length(bet_number) = 8;

-- Also update 'number' column if it exists (old schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bets_archive'
      AND column_name = 'number'
  ) THEN
    UPDATE bets_archive
    SET number = LPAD(number, 10, '0')
    WHERE bet_type = 'BORRATINA'
      AND char_length(number) = 8;
  END IF;
END $$;

-- ============================================================================
-- 3. Add updated constraints matching main bets table
-- ============================================================================

-- Note: Using bet_number column (current schema) instead of number (old schema)
-- The migration handles both cases with conditional logic

-- Check for allowed number lengths (1, 2, 3, 4, 10)
ALTER TABLE bets_archive
ADD CONSTRAINT chk_archive_number_allowed_lengths
  CHECK (char_length(
    COALESCE(bet_number, number)  -- Handle both old and new column names
  ) IN (1, 2, 3, 4, 10));

-- BORRATINA must have exactly 10 characters
ALTER TABLE bets_archive
ADD CONSTRAINT chk_archive_borratina_number_with_length
  CHECK (
    bet_type != 'BORRATINA' OR char_length(
      COALESCE(bet_number, number)
    ) = 10
  );

-- REDOUBLE must have 2-char number AND 2-char "with"
-- Note: Using "with" column (quoted because it's a SQL keyword)
ALTER TABLE bets_archive
ADD CONSTRAINT chk_archive_redouble_number_with_length
  CHECK (
    bet_type != 'REDOUBLE' OR
    (char_length(COALESCE(bet_number, number)) = 2 AND char_length("with") = 2)
  );

-- Position must be valid for the given place
ALTER TABLE bets_archive
ADD CONSTRAINT chk_archive_position_valid_for_place
  CHECK (
    position IS NULL OR (
      (position = 'FIVE' AND place IN ('HEAD', 'FIVE')) OR
      (position = 'TEN' AND place IN ('HEAD','FIVE','TEN')) OR
      (position = 'TWENTY' AND place IN ('HEAD','FIVE','TEN','TWENTY'))
    )
  );

-- "with" and position must both be set or both be null
ALTER TABLE bets_archive
ADD CONSTRAINT chk_archive_with_and_position_dependency
  CHECK (
    ("with" IS NULL AND position IS NULL) OR ("with" IS NOT NULL AND position IS NOT NULL)
  );

-- Only REDOUBLE can have "with" and position
ALTER TABLE bets_archive
ADD CONSTRAINT chk_archive_redouble_requires_with_position
  CHECK (
    ("with" IS NULL AND position IS NULL) OR (bet_type = 'REDOUBLE')
  );

-- ============================================================================
-- 4. Verification
-- ============================================================================

DO $$
DECLARE
  v_constraints_count INT;
  v_borratina_8_count INT;
  v_borratina_10_count INT;
BEGIN
  -- Count constraints
  SELECT COUNT(*) INTO v_constraints_count
  FROM information_schema.table_constraints
  WHERE table_name = 'bets_archive'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE 'chk_archive_%';

  -- Count BORRATINA records by length
  SELECT
    COUNT(*) FILTER (WHERE char_length(COALESCE(bet_number, number)) = 8),
    COUNT(*) FILTER (WHERE char_length(COALESCE(bet_number, number)) = 10)
  INTO v_borratina_8_count, v_borratina_10_count
  FROM bets_archive
  WHERE bet_type = 'BORRATINA';

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Archive Constraints Updated';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Check constraints on bets_archive: %', v_constraints_count;
  RAISE NOTICE 'BORRATINA bets with length 8: %', v_borratina_8_count;
  RAISE NOTICE 'BORRATINA bets with length 10: %', v_borratina_10_count;
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '1. Updated BORRATINA constraint: length 8 → length 10';
  RAISE NOTICE '2. Padded existing 8-char BORRATINA to 10 chars';
  RAISE NOTICE '3. All constraints now match main bets table';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Next: Archive cron should work without constraint errors';
  RAISE NOTICE '================================================';
END $$;
