-- Migration: Initial data migration for custom auth
-- Date: 2025-12-27
-- Description: Sets password_reset_required for all existing users without password_hash

-- Mark all existing users to require password reset
-- Admins will need to reset passwords for all users
UPDATE users
SET password_reset_required = TRUE
WHERE deleted_at IS NULL
  AND disabled = FALSE
  AND password_hash IS NULL;

-- Create audit log entry for migration
INSERT INTO auth_audit_log (
  event_type,
  success,
  username,
  metadata
)
VALUES (
  'system_migration',
  TRUE,
  'system',
  jsonb_build_object(
    'migration', 'supabase_to_custom_auth',
    'timestamp', NOW(),
    'description', 'Migrated to custom JWT authentication system'
  )
);

-- Log migration completion
DO $$
DECLARE
  affected_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO affected_users
  FROM users
  WHERE deleted_at IS NULL
    AND disabled = FALSE
    AND password_hash IS NULL
    AND password_reset_required = TRUE;

  RAISE NOTICE 'Migration complete: % users marked for password reset', affected_users;
END $$;
