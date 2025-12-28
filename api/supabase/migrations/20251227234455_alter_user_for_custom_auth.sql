-- Migration: Alter users table for custom authentication
-- Date: 2025-12-27
-- Description: Adds password management and security tracking columns to users table

-- Add new columns for custom authentication
ALTER TABLE users
  -- Password management
  ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN NOT NULL DEFAULT FALSE,

  -- Security tracking
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_login_ip INET DEFAULT NULL;

-- Create index for login lookups (username + active status)
CREATE INDEX IF NOT EXISTS idx_users_username_active
  ON users(username)
  WHERE deleted_at IS NULL AND disabled = FALSE;

-- Create index for locked accounts
CREATE INDEX IF NOT EXISTS idx_users_locked
  ON users(locked_until)
  WHERE locked_until IS NOT NULL;

-- Helper function to increment failed login attempts
CREATE OR REPLACE FUNCTION increment_failed_attempts(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET failed_login_attempts = failed_login_attempts + 1
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hash of user password (12 rounds)';
COMMENT ON COLUMN users.password_reset_required IS 'Forces user to change password on next login';
COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for brute force protection';
COMMENT ON COLUMN users.locked_until IS 'Account lockout timestamp after max failed attempts';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last successful login';
COMMENT ON COLUMN users.last_login_ip IS 'IP address of last successful login';
