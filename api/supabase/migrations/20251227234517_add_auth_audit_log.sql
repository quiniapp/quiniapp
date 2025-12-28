-- Migration: Create auth audit log table
-- Date: 2025-12-27
-- Description: Creates comprehensive audit trail for all authentication and session events

CREATE TABLE IF NOT EXISTS auth_audit_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id UUID,
  organization_id UUID,

  -- Event details
  event_type TEXT NOT NULL,
  -- Event types: login_success, login_failed, logout, logout_all, refresh_token,
  --              refresh_token_invalid, token_reuse_detected, account_locked,
  --              password_changed, password_reset_by_admin, session_expired, system_migration

  -- Request context
  ip_address INET,
  user_agent TEXT,
  username TEXT,

  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- Additional metadata (JSONB for extensibility)
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign keys (nullable - user might not exist for failed logins)
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_session FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_organization FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX idx_audit_user_id ON auth_audit_log(user_id);
CREATE INDEX idx_audit_session_id ON auth_audit_log(session_id);
CREATE INDEX idx_audit_organization_id ON auth_audit_log(organization_id);
CREATE INDEX idx_audit_event_type ON auth_audit_log(event_type);
CREATE INDEX idx_audit_created_at ON auth_audit_log(created_at DESC);
CREATE INDEX idx_audit_ip_address ON auth_audit_log(ip_address);
CREATE INDEX idx_audit_username ON auth_audit_log(username);

-- Composite index for failed login analysis
CREATE INDEX idx_audit_failed_logins
  ON auth_audit_log(username, created_at DESC)
  WHERE success = FALSE AND event_type = 'login_failed';

-- Comments for documentation
COMMENT ON TABLE auth_audit_log IS 'Comprehensive audit trail for all authentication and session events';
COMMENT ON COLUMN auth_audit_log.event_type IS 'Type of authentication event (login_success, login_failed, logout, refresh_token, etc.)';
COMMENT ON COLUMN auth_audit_log.username IS 'Username attempted (stored even if user_id is NULL for failed logins)';
COMMENT ON COLUMN auth_audit_log.metadata IS 'Additional event-specific data (JSON format for extensibility)';
