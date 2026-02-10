-- ============================================================================
-- Migration: Add archive validation to generate_winners
-- ============================================================================
-- Validates that data exists in MAIN tables before generating winners
-- Prevents errors when trying to generate winners for archived dates
-- ============================================================================

-- Drop and recreate generate_winners with validation
DROP FUNCTION IF EXISTS generate_winners(UUID, DATE, UUID);

CREATE OR REPLACE FUNCTION generate_winners(
  target_id UUID,
  bet_date DATE,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_affected_tickets INT := 0;
  v_winner_tickets INT := 0;
  v_main_bets_count INT;
  v_archive_bets_count INT;
BEGIN
  -- ============================================================================
  -- VALIDATION: Check if data is in main table (writable)
  -- ============================================================================

  SELECT COUNT(*) INTO v_main_bets_count
  FROM bets
  WHERE schedule_id = target_id
    AND date = bet_date
    AND organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF v_main_bets_count = 0 THEN
    -- Check if data was archived
    SELECT COUNT(*) INTO v_archive_bets_count
    FROM bets_archive
    WHERE schedule_id = target_id
      AND date = bet_date
      AND organization_id = p_organization_id
      AND deleted_at IS NULL;

    IF v_archive_bets_count > 0 THEN
      RAISE EXCEPTION 'BETS_ARCHIVED: No se pueden generar ganadores para fechas archivadas. Los datos del % están en archive (read-only). Solo se pueden generar ganadores para fechas activas en las tablas principales.', bet_date;
    ELSE
      RAISE EXCEPTION 'NO_BETS_FOUND: No hay apuestas para esta fecha (%), schedule (%) y organización (%).', bet_date, target_id, p_organization_id;
    END IF;
  END IF;

  -- ============================================================================
  -- MAIN LOGIC: Generate winners (unchanged from original)
  -- ============================================================================

  WITH
  calculated_payouts AS (
    SELECT
      b.bet_id,
      b.ticket_id,
      COALESCE(cp.payout, 0::NUMERIC) AS payout,
      COALESCE(cp.hits, 0::INT) AS hits
    FROM bets b
    JOIN results r
      ON b.lottery_id = r.lottery_id
     AND b.schedule_id = r.schedule_id
     AND b.date = r.date
     AND b.organization_id = r.organization_id
     AND r.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT payout, hits FROM calculate_one_payout(b, r.results) WHERE b.bet_type = 'ONE'
      UNION ALL
      SELECT payout, hits FROM calculate_double_payout(b, r.results) WHERE b.bet_type = 'DOUBLE'
      UNION ALL
      SELECT payout, hits FROM calculate_tern_payout(b, r.results) WHERE b.bet_type = 'TERN'
      UNION ALL
      SELECT payout, hits FROM calculate_quatern_payout(b, r.results) WHERE b.bet_type = 'QUATERN'
      UNION ALL
      SELECT payout, hits FROM calculate_borratina_payout(b, r.results) WHERE b.bet_type = 'BORRATINA'
      UNION ALL
      SELECT payout, hits FROM calculate_redouble_payout(b, r.results) WHERE b.bet_type = 'REDOUBLE'
    ) cp ON TRUE
    WHERE b.schedule_id = target_id
      AND b.date = bet_date
      AND b.organization_id = p_organization_id
      AND b.deleted_at IS NULL
  ),
  up_bets AS (
    UPDATE bets b
    SET prize = cp.payout,
        hits = cp.hits,
        winner = (cp.payout > 0)
    FROM calculated_payouts cp
    WHERE b.bet_id = cp.bet_id
      AND b.organization_id = p_organization_id
    RETURNING b.ticket_id, cp.payout, cp.hits
  ),
  per_ticket_turn AS (
    SELECT
      ticket_id,
      SUM(payout) AS prize_turn,
      SUM(hits) AS hits_turn
    FROM up_bets
    GROUP BY ticket_id
  ),
  deleted_turn AS (
    DELETE FROM ticket_prizes_by_turn tpt
    WHERE tpt.schedule_id = target_id
      AND tpt.date = bet_date
      AND tpt.organization_id = p_organization_id
    RETURNING tpt.ticket_id
  ),
  affected_tickets AS (
    SELECT ticket_id FROM per_ticket_turn
    UNION
    SELECT ticket_id FROM deleted_turn
  ),
  inserted_turn AS (
    INSERT INTO ticket_prizes_by_turn
      (ticket_id, schedule_id, date, prize_turn, hits_turn, updated_at, organization_id)
    SELECT
      p.ticket_id,
      target_id,
      bet_date,
      p.prize_turn,
      p.hits_turn,
      NOW(),
      p_organization_id
    FROM per_ticket_turn p
  ),
  previous_turns AS (
    SELECT
      tpt.ticket_id,
      SUM(tpt.prize_turn) AS prize_prev,
      SUM(tpt.hits_turn) AS hits_prev
    FROM ticket_prizes_by_turn tpt
    JOIN affected_tickets at ON at.ticket_id = tpt.ticket_id
    WHERE tpt.date = bet_date
      AND tpt.schedule_id <> target_id
      AND tpt.organization_id = p_organization_id
    GROUP BY tpt.ticket_id
  ),
  totals_per_day AS (
    SELECT
      ticket_id,
      SUM(prize) AS total_prize,
      SUM(hits) AS total_hits
    FROM (
      SELECT
        p.ticket_id,
        p.prize_turn AS prize,
        p.hits_turn AS hits
      FROM per_ticket_turn p
      UNION ALL
      SELECT
        pt.ticket_id,
        pt.prize_prev AS prize,
        pt.hits_prev AS hits
      FROM previous_turns pt
    ) s
    GROUP BY ticket_id
  ),
  updated_tickets AS (
    UPDATE tickets t
    SET total_prize = COALESCE(tt.total_prize, 0),
        hits = COALESCE(tt.total_hits, 0),
        winner = (COALESCE(tt.total_prize, 0) > 0)
    FROM affected_tickets at
    LEFT JOIN totals_per_day tt ON tt.ticket_id = at.ticket_id
    WHERE t.ticket_id = at.ticket_id
      AND t.date = bet_date
      AND t.organization_id = p_organization_id
    RETURNING t.ticket_id, (COALESCE(tt.total_prize, 0) > 0) as is_winner
  )
  SELECT
    COUNT(*)::INT as total,
    COUNT(*) FILTER (WHERE is_winner)::INT as winners
  INTO v_affected_tickets, v_winner_tickets
  FROM updated_tickets;

  RETURN jsonb_build_object(
    'success', true,
    'schedule_id', target_id,
    'date', bet_date,
    'affected_tickets', COALESCE(v_affected_tickets, 0),
    'winner_tickets', COALESCE(v_winner_tickets, 0)
  );
END;
$$;

COMMENT ON FUNCTION generate_winners IS
'Generates winners for a specific schedule and date. Only works on main tables (not archive).
Validates that data exists in main tables before processing.
Raises BETS_ARCHIVED error if data is in archive tables (read-only).';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Archive Validation Added to generate_winners';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '1. Validates data exists in MAIN tables before processing';
  RAISE NOTICE '2. Checks ARCHIVE tables if not found in main';
  RAISE NOTICE '3. Raises descriptive errors:';
  RAISE NOTICE '   - BETS_ARCHIVED: Data is in archive (cannot generate)';
  RAISE NOTICE '   - NO_BETS_FOUND: No data for date/schedule';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Impact:';
  RAISE NOTICE '- Generate winners only works for active dates (last 2 days)';
  RAISE NOTICE '- Archived dates cannot have winners regenerated';
  RAISE NOTICE '- Clear error messages for troubleshooting';
  RAISE NOTICE '================================================';
END $$;
