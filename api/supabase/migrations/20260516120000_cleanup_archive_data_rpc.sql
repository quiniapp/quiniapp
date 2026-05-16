-- Cleanup old rows from archive tables (older than N days)
-- Deletes bets first (they reference tickets via ticket_id), then tickets

DROP FUNCTION IF EXISTS cleanup_old_archive_data(INTEGER);

CREATE OR REPLACE FUNCTION cleanup_old_archive_data(p_days INTEGER DEFAULT 65)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff_date DATE := CURRENT_DATE - (p_days || ' days')::INTERVAL;
  v_bets_deleted INTEGER;
  v_tickets_deleted INTEGER;
BEGIN
  DELETE FROM bets_archive WHERE date < v_cutoff_date;
  GET DIAGNOSTICS v_bets_deleted = ROW_COUNT;

  DELETE FROM tickets_archive WHERE date < v_cutoff_date;
  GET DIAGNOSTICS v_tickets_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'cutoff_date', v_cutoff_date,
    'bets_deleted', v_bets_deleted,
    'tickets_deleted', v_tickets_deleted
  );
END;
$$;
