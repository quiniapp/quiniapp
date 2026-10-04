-- 1) Archive cleanup in batches
-- cleanup_old_archive_data deleted every archive row older than N days in a
-- single statement. With months of archive that blew PostgREST's
-- statement_timeout ("canceling statement due to statement timeout") and, long
-- before that, the web proxy gave up on the POST after 4s and answered
-- BACKEND_UNAVAILABLE. Same fix as archive_data_by_date: one batch per RPC call,
-- the caller loops until `done`. Deleting is idempotent, so a retried call is
-- harmless.
--
-- 2) total_storage_view measures the whole database
-- It summed pg_total_relation_size over public tables only, so it left out
-- auth, storage, other schemas and system catalogs and read lower than the
-- database size the Supabase plan limit is enforced against.
-- pg_database_size(current_database()) is that number. Columns are unchanged.

DROP FUNCTION IF EXISTS cleanup_old_archive_data(INTEGER);
DROP FUNCTION IF EXISTS cleanup_old_archive_data_batch(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION cleanup_old_archive_data_batch(
  p_days INTEGER DEFAULT 65,
  p_batch_size INTEGER DEFAULT 5000
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff_date DATE := CURRENT_DATE - p_days;
  v_bets_deleted INTEGER := 0;
  v_tickets_deleted INTEGER := 0;
BEGIN
  -- Bets first (they point at their ticket via ticket_id), served by idx_bets_archive_date
  DELETE FROM bets_archive
  WHERE bet_id IN (
    SELECT bet_id FROM bets_archive WHERE date < v_cutoff_date LIMIT p_batch_size
  );
  GET DIAGNOSTICS v_bets_deleted = ROW_COUNT;

  -- Tickets only once every old bet is gone, served by idx_tickets_archive_date
  IF v_bets_deleted < p_batch_size THEN
    DELETE FROM tickets_archive
    WHERE ticket_id IN (
      SELECT ticket_id FROM tickets_archive WHERE date < v_cutoff_date LIMIT p_batch_size
    );
    GET DIAGNOSTICS v_tickets_deleted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'cutoff_date', v_cutoff_date,
    'bets_deleted', v_bets_deleted,
    'tickets_deleted', v_tickets_deleted,
    'done', v_bets_deleted < p_batch_size AND v_tickets_deleted < p_batch_size
  );
END;
$$;

REVOKE ALL ON FUNCTION cleanup_old_archive_data_batch(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_archive_data_batch(INTEGER, INTEGER) TO service_role;

DROP VIEW IF EXISTS public.total_storage_view;
CREATE VIEW public.total_storage_view AS
SELECT
  pg_database_size(current_database()) AS total_bytes,
  round(pg_database_size(current_database()) / (1024.0 * 1024.0), 2) AS total_mb,
  round(pg_database_size(current_database()) / (1024.0 * 1024.0 * 1024.0), 2) AS total_gb;

REVOKE ALL ON public.total_storage_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.total_storage_view TO service_role;
