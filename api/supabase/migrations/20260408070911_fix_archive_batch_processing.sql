-- Fix archive stored procedures to use batched processing
-- Previous implementation did single DELETE on 1M+ rows, causing statement timeout.
-- New implementation loops in batches of 5000 rows.

DROP FUNCTION IF EXISTS archive_old_bets(INTEGER);

CREATE OR REPLACE FUNCTION archive_old_bets(p_days_to_keep INTEGER DEFAULT 2)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff_date DATE;
  v_total_count INTEGER := 0;
  v_batch_size INTEGER := 5000;
  v_batch_deleted INTEGER;
BEGIN
  SELECT ad.date INTO v_cutoff_date
  FROM activity_days ad
  WHERE ad.has_activity = true
  ORDER BY ad.date DESC
  OFFSET p_days_to_keep - 1
  LIMIT 1;

  IF v_cutoff_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Not enough active days to archive',
      'cutoff_date', NULL,
      'archived_count', 0,
      'deleted_count', 0,
      'days_kept', p_days_to_keep
    );
  END IF;

  LOOP
    WITH to_delete AS (
      SELECT bet_id FROM bets WHERE date < v_cutoff_date LIMIT v_batch_size
    ),
    archived AS (
      INSERT INTO bets_archive
      SELECT
        b.bet_id, b.bet_type, b.ticket_id, b.user_id, b.number, b.amount, b.place,
        b."with", b.position, b.date, b.winner, b.paid, b.lottery_id, b.schedule_id,
        b.created_at, b.edited_at, b.deleted_at, NOW() AS archived_at
      FROM bets b
      WHERE b.bet_id IN (SELECT bet_id FROM to_delete)
      ON CONFLICT (bet_id) DO NOTHING
    )
    DELETE FROM bets WHERE bet_id IN (SELECT bet_id FROM to_delete);

    GET DIAGNOSTICS v_batch_deleted = ROW_COUNT;
    v_total_count := v_total_count + v_batch_deleted;

    EXIT WHEN v_batch_deleted = 0;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bets archived successfully',
    'cutoff_date', v_cutoff_date,
    'archived_count', v_total_count,
    'deleted_count', v_total_count,
    'days_kept', p_days_to_keep
  );
END;
$$;

DROP FUNCTION IF EXISTS archive_old_tickets(INTEGER);

CREATE OR REPLACE FUNCTION archive_old_tickets(p_days_to_keep INTEGER DEFAULT 2)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff_date DATE;
  v_total_count INTEGER := 0;
  v_batch_size INTEGER := 5000;
  v_batch_deleted INTEGER;
BEGIN
  SELECT ad.date INTO v_cutoff_date
  FROM activity_days ad
  WHERE ad.has_activity = true
  ORDER BY ad.date DESC
  OFFSET p_days_to_keep - 1
  LIMIT 1;

  IF v_cutoff_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Not enough active days to archive',
      'cutoff_date', NULL,
      'archived_count', 0,
      'deleted_count', 0,
      'days_kept', p_days_to_keep
    );
  END IF;

  LOOP
    WITH to_delete AS (
      SELECT ticket_id FROM tickets WHERE date < v_cutoff_date LIMIT v_batch_size
    ),
    archived AS (
      INSERT INTO tickets_archive
      SELECT
        t.ticket_id, t.user_id, t.user_name, t.ticket_number, t.date,
        t.paid, t.winner, t.total, t.created_at, t.deleted_at, t.deleted_by,
        NOW() AS archived_at
      FROM tickets t
      WHERE t.ticket_id IN (SELECT ticket_id FROM to_delete)
      ON CONFLICT (ticket_id) DO NOTHING
    )
    DELETE FROM tickets WHERE ticket_id IN (SELECT ticket_id FROM to_delete);

    GET DIAGNOSTICS v_batch_deleted = ROW_COUNT;
    v_total_count := v_total_count + v_batch_deleted;

    EXIT WHEN v_batch_deleted = 0;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Tickets archived successfully',
    'cutoff_date', v_cutoff_date,
    'archived_count', v_total_count,
    'deleted_count', v_total_count,
    'days_kept', p_days_to_keep
  );
END;
$$;

DROP FUNCTION IF EXISTS archive_old_data(INTEGER);

CREATE OR REPLACE FUNCTION archive_old_data(p_days_to_keep INTEGER DEFAULT 2)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_bets_result JSONB;
  v_tickets_result JSONB;
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
BEGIN
  v_start_time := clock_timestamp();

  SELECT archive_old_bets(p_days_to_keep) INTO v_bets_result;
  SELECT archive_old_tickets(p_days_to_keep) INTO v_tickets_result;

  v_end_time := clock_timestamp();

  RETURN jsonb_build_object(
    'success', true,
    'bets', v_bets_result,
    'tickets', v_tickets_result,
    'execution_time_ms', EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))
  );
END;
$$;
