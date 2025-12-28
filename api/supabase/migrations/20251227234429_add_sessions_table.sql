-- Migration: Create sessions table for custom JWT authentication
-- Date: 2025-12-27
-- Description: Creates sessions table for tracking user sessions with refresh tokens

CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,

  -- Tokens
  refresh_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_version INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,

  -- Time tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Foreign keys
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_organization FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_organization_id ON sessions(organization_id);
CREATE INDEX idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_is_active ON sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_active) WHERE is_active = TRUE;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE sessions
  SET
    is_active = FALSE,
    revoked_at = NOW(),
    revoked_reason = 'expired'
  WHERE expires_at < NOW()
    AND is_active = TRUE;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE sessions IS 'Stores active user sessions with refresh token tracking';
COMMENT ON COLUMN sessions.refresh_token_hash IS 'Bcrypt hash of the refresh token (12 rounds)';
COMMENT ON COLUMN sessions.refresh_token_version IS 'Version number for token rotation detection';
COMMENT ON COLUMN sessions.expires_at IS 'Session expiration time (sliding window: 4 hours from last activity)';
COMMENT ON COLUMN sessions.revoked_reason IS 'Reason for revocation: user_logout, expired, suspicious_activity, admin_revoke, password_change';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Marks expired sessions as inactive. Run periodically via cron or manual call.';
