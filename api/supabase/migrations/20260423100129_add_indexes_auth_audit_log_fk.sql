-- Add missing indexes for foreign keys on auth_audit_log
-- fk_audit_user (user_id) and fk_audit_session (session_id) were unindexed

CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON public.auth_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_session_id ON public.auth_audit_log (session_id);
