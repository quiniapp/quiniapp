-- Migration: Add batch_update_session_activity function
-- Date: 2026-04-07
-- Description: Efficient single-query batch update for session activity flush from in-memory cache

CREATE OR REPLACE FUNCTION batch_update_session_activity(
  p_session_ids UUID[],
  p_activity_times TIMESTAMPTZ[],
  p_expiry_times TIMESTAMPTZ[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sessions s
  SET
    last_activity_at = data.last_activity_at,
    expires_at = data.expires_at
  FROM UNNEST(p_session_ids, p_activity_times, p_expiry_times)
    AS data(session_id, last_activity_at, expires_at)
  WHERE s.session_id = data.session_id
    AND s.is_active = TRUE;
END;
$$;

COMMENT ON FUNCTION batch_update_session_activity IS
  'Batch updates last_activity_at and expires_at for multiple sessions in a single query. Used by the session monitor job to flush the in-memory activity cache to the database.';
