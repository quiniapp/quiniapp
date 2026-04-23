-- Fix archive statement timeout: process one batch per RPC call instead of
-- looping inside the function. The entire plpgsql loop counted as one statement
-- from PostgREST's perspective, causing statement_timeout on large days.
-- TypeScript now loops calling this function until bets_remaining + tickets_remaining = 0.

CREATE OR REPLACE FUNCTION archive_data_by_date(p_date DATE, p_batch_size INTEGER DEFAULT 5000)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_bets_archived     INTEGER := 0;
  v_tickets_archived  INTEGER := 0;
  v_bets_remaining    INTEGER;
  v_tickets_remaining INTEGER;
BEGIN
  -- Step 1: Archive one batch of bets (must come before tickets: FK bets.ticket_id → tickets)
  WITH to_archive AS (
    SELECT bet_id FROM bets WHERE date = p_date LIMIT p_batch_size
  ),
  inserted AS (
    INSERT INTO bets_archive (
      bet_id, bet_type, ticket_id, user_id, number, amount, place, "with",
      position, date, winner, paid, lottery_id, schedule_id, created_at,
      edited_at, deleted_at, prize, ticket_number, cashier_name, hits,
      bet_order, organization_id,
      archived_at
    )
    SELECT b.*, NOW()
    FROM bets b
    WHERE b.bet_id IN (SELECT bet_id FROM to_archive)
    ON CONFLICT (bet_id) DO NOTHING
  )
  DELETE FROM bets WHERE bet_id IN (SELECT bet_id FROM to_archive);

  GET DIAGNOSTICS v_bets_archived = ROW_COUNT;

  -- Step 2: Only move to tickets once all bets for this date are gone (FK safety)
  IF v_bets_archived = 0 THEN
    WITH to_archive AS (
      SELECT ticket_id FROM tickets WHERE date = p_date LIMIT p_batch_size
    ),
    inserted AS (
      INSERT INTO tickets_archive (
        ticket_id, user_id, user_name, ticket_number, date, paid, winner, total,
        created_at, deleted_at, deleted_by, total_prize, hits, organization_id,
        client_request_id,
        archived_at
      )
      SELECT t.*, NOW()
      FROM tickets t
      WHERE t.ticket_id IN (SELECT ticket_id FROM to_archive)
      ON CONFLICT (ticket_id) DO NOTHING
    )
    DELETE FROM tickets WHERE ticket_id IN (SELECT ticket_id FROM to_archive);

    GET DIAGNOSTICS v_tickets_archived = ROW_COUNT;
  END IF;

  SELECT COUNT(*) INTO v_bets_remaining    FROM bets    WHERE date = p_date;
  SELECT COUNT(*) INTO v_tickets_remaining FROM tickets WHERE date = p_date;

  RETURN jsonb_build_object(
    'success',            true,
    'date',               p_date,
    'bets_archived',      v_bets_archived,
    'tickets_archived',   v_tickets_archived,
    'bets_remaining',     v_bets_remaining,
    'tickets_remaining',  v_tickets_remaining
  );
END;
$$;
