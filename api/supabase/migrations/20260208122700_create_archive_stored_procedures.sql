-- Stored procedures for archiving operations
-- These are optional performance optimizations

-- Function to archive bets older than N active days
DROP FUNCTION IF EXISTS archive_old_bets(INTEGER);

CREATE OR REPLACE FUNCTION archive_old_bets(p_days_to_keep INTEGER DEFAULT 3)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff_date DATE;
  v_archived_count INTEGER := 0;
  v_deleted_count INTEGER := 0;
BEGIN
  -- Get the cutoff date (Nth most recent active day)
  SELECT ad.date INTO v_cutoff_date
  FROM activity_days ad
  WHERE ad.has_activity = true
  ORDER BY ad.date DESC
  OFFSET p_days_to_keep - 1
  LIMIT 1;

  -- If we don't have enough active days, do nothing
  IF v_cutoff_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Not enough active days to archive',
      'cutoff_date', NULL,
      'archived_count', 0,
      'deleted_count', 0
    );
  END IF;

  -- Insert old bets into archive (INCLUDING deleted ones)
  INSERT INTO bets_archive
  SELECT
    bet_id, bet_type, ticket_id, user_id, number, amount, place,
    "with", position, date, winner, paid, lottery_id, schedule_id,
    created_at, edited_at, deleted_at, NOW() as archived_at
  FROM bets
  WHERE date < v_cutoff_date;
  -- Note: Archives ALL bets (deleted_at IS NULL AND deleted_at IS NOT NULL)

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  -- Delete archived bets from main table (INCLUDING deleted ones)
  DELETE FROM bets
  WHERE date < v_cutoff_date;
  -- Note: Deletes ALL archived bets (deleted_at IS NULL AND deleted_at IS NOT NULL)

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bets archived successfully',
    'cutoff_date', v_cutoff_date,
    'archived_count', v_archived_count,
    'deleted_count', v_deleted_count,
    'days_kept', p_days_to_keep
  );
END;
$$;

-- Function to archive tickets older than N active days
DROP FUNCTION IF EXISTS archive_old_tickets(INTEGER);

CREATE OR REPLACE FUNCTION archive_old_tickets(p_days_to_keep INTEGER DEFAULT 3)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff_date DATE;
  v_archived_count INTEGER := 0;
  v_deleted_count INTEGER := 0;
BEGIN
  -- Get the cutoff date (Nth most recent active day)
  SELECT ad.date INTO v_cutoff_date
  FROM activity_days ad
  WHERE ad.has_activity = true
  ORDER BY ad.date DESC
  OFFSET p_days_to_keep - 1
  LIMIT 1;

  -- If we don't have enough active days, do nothing
  IF v_cutoff_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Not enough active days to archive',
      'cutoff_date', NULL,
      'archived_count', 0,
      'deleted_count', 0
    );
  END IF;

  -- Insert old tickets into archive (INCLUDING deleted ones)
  INSERT INTO tickets_archive
  SELECT
    ticket_id, user_id, user_name, ticket_number, date,
    paid, winner, total, created_at, deleted_at, deleted_by,
    NOW() as archived_at
  FROM tickets
  WHERE date < v_cutoff_date;
  -- Note: Archives ALL tickets (deleted_at IS NULL AND deleted_at IS NOT NULL)

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  -- Delete archived tickets from main table (INCLUDING deleted ones)
  DELETE FROM tickets
  WHERE date < v_cutoff_date;
  -- Note: Deletes ALL archived tickets (deleted_at IS NULL AND deleted_at IS NOT NULL)

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Tickets archived successfully',
    'cutoff_date', v_cutoff_date,
    'archived_count', v_archived_count,
    'deleted_count', v_deleted_count,
    'days_kept', p_days_to_keep
  );
END;
$$;

-- Function to archive both bets and tickets in a single transaction
DROP FUNCTION IF EXISTS archive_old_data(INTEGER);

CREATE OR REPLACE FUNCTION archive_old_data(p_days_to_keep INTEGER DEFAULT 3)
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

  -- Archive bets
  SELECT archive_old_bets(p_days_to_keep) INTO v_bets_result;

  -- Archive tickets
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

-- Function to get archive statistics
DROP FUNCTION IF EXISTS get_archive_stats();

CREATE OR REPLACE FUNCTION get_archive_stats()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_bets_main_count INTEGER;
  v_bets_archive_count INTEGER;
  v_tickets_main_count INTEGER;
  v_tickets_archive_count INTEGER;
  v_active_days_count INTEGER;
  v_last_active_date DATE;
BEGIN
  -- Count records in main tables (ALL rows, including deleted)
  SELECT COUNT(*) INTO v_bets_main_count FROM bets;
  SELECT COUNT(*) INTO v_tickets_main_count FROM tickets;

  -- Count records in archive tables
  SELECT COUNT(*) INTO v_bets_archive_count FROM bets_archive;
  SELECT COUNT(*) INTO v_tickets_archive_count FROM tickets_archive;

  -- Count active days
  SELECT COUNT(*) INTO v_active_days_count
  FROM activity_days WHERE has_activity = true;

  -- Get last active date
  SELECT date INTO v_last_active_date
  FROM activity_days
  WHERE has_activity = true
  ORDER BY date DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'main_tables', jsonb_build_object(
      'bets_count', v_bets_main_count,
      'tickets_count', v_tickets_main_count
    ),
    'archive_tables', jsonb_build_object(
      'bets_count', v_bets_archive_count,
      'tickets_count', v_tickets_archive_count
    ),
    'activity', jsonb_build_object(
      'active_days_count', v_active_days_count,
      'last_active_date', v_last_active_date
    ),
    'compression_ratio', jsonb_build_object(
      'bets', CASE
        WHEN v_bets_archive_count > 0
        THEN ROUND((v_bets_archive_count::NUMERIC / (v_bets_main_count + v_bets_archive_count)) * 100, 2)
        ELSE 0
      END,
      'tickets', CASE
        WHEN v_tickets_archive_count > 0
        THEN ROUND((v_tickets_archive_count::NUMERIC / (v_tickets_main_count + v_tickets_archive_count)) * 100, 2)
        ELSE 0
      END
    )
  );
END;
$$;
