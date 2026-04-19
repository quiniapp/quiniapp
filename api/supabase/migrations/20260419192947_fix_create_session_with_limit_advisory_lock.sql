-- Migration: Fix create_session_with_limit - replace invalid FOR UPDATE on aggregate with advisory lock
-- Date: 2026-04-19
-- Bug: SELECT COUNT(*) ... FOR UPDATE is invalid PostgreSQL - cannot use FOR UPDATE with aggregates
-- Fix: Use pg_advisory_xact_lock per user_id to serialize concurrent session creation

DROP FUNCTION IF EXISTS create_session_with_limit(UUID, UUID, TEXT, INET, TEXT, INT, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION create_session_with_limit(
  p_user_id UUID,
  p_organization_id UUID,
  p_refresh_token_hash TEXT,
  p_ip_address INET,
  p_user_agent TEXT,
  p_max_sessions INT,
  p_expires_at TIMESTAMPTZ
)
RETURNS sessions
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_session sessions;
BEGIN
  -- Serialize concurrent session creation for same user via advisory lock.
  -- Advisory lock is released automatically at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext('create_session:' || p_user_id::text));

  IF p_max_sessions > 0 THEN
    SELECT COUNT(*) INTO v_count
    FROM sessions
    WHERE user_id = p_user_id AND is_active = TRUE;

    WHILE v_count >= p_max_sessions LOOP
      UPDATE sessions
      SET
        is_active = FALSE,
        revoked_at = NOW(),
        revoked_reason = 'max_concurrent_sessions_exceeded'
      WHERE session_id = (
        SELECT session_id
        FROM sessions
        WHERE user_id = p_user_id AND is_active = TRUE
        ORDER BY created_at ASC
        LIMIT 1
      );
      v_count := v_count - 1;
    END LOOP;
  END IF;

  INSERT INTO sessions (
    user_id,
    organization_id,
    refresh_token_hash,
    refresh_token_version,
    ip_address,
    user_agent,
    created_at,
    last_activity_at,
    expires_at,
    is_active
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_refresh_token_hash,
    1,
    p_ip_address,
    p_user_agent,
    NOW(),
    NOW(),
    p_expires_at,
    TRUE
  )
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

COMMENT ON FUNCTION create_session_with_limit IS
  'Atomically enforces concurrent session limit then creates new session. Uses pg_advisory_xact_lock per user_id to prevent TOCTOU race on session count.';
