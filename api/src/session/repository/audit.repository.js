import { supabase } from '@database/db.connection';
export class AuditRepository {
    /**
     * Log an authentication/session event
     */
    async log(params) {
        const { error } = await supabase.from('auth_audit_log').insert({
            user_id: params.user_id || null,
            session_id: params.session_id || null,
            organization_id: params.organization_id || null,
            event_type: params.event_type,
            ip_address: params.ip_address || null,
            user_agent: params.user_agent || null,
            username: params.username || null,
            success: params.success,
            error_message: params.error_message || null,
            metadata: params.metadata || {},
            created_at: new Date().toISOString(),
        });
        if (error) {
            console.error('[AuditRepository] Failed to create audit log:', error);
            // Don't throw - audit logging should not break app flow
        }
    }
    /**
     * Get recent failed login attempts for a username (for brute force detection)
     */
    async getRecentFailedAttempts(username, windowMinutes = 15) {
        const since = new Date(Date.now() - windowMinutes * 60 * 1000);
        const { count, error } = await supabase
            .from('auth_audit_log')
            .select('*', { count: 'exact', head: true })
            .eq('username', username)
            .eq('event_type', 'login_failed')
            .eq('success', false)
            .gte('created_at', since.toISOString());
        if (error) {
            console.error('[AuditRepository] Failed to get failed attempts:', error);
            return 0;
        }
        return count || 0;
    }
    /**
     * Get recent failed login attempts by IP address
     */
    async getRecentFailedAttemptsByIP(ipAddress, windowMinutes = 15) {
        const since = new Date(Date.now() - windowMinutes * 60 * 1000);
        const { count, error } = await supabase
            .from('auth_audit_log')
            .select('*', { count: 'exact', head: true })
            .eq('ip_address', ipAddress)
            .eq('event_type', 'login_failed')
            .eq('success', false)
            .gte('created_at', since.toISOString());
        if (error) {
            console.error('[AuditRepository] Failed to get failed attempts by IP:', error);
            return 0;
        }
        return count || 0;
    }
    /**
     * Get audit logs for a user
     */
    async getUserLogs(userId, limit = 100) {
        const { data, error } = await supabase
            .from('auth_audit_log')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('[AuditRepository] Failed to get user logs:', error);
            return [];
        }
        return data || [];
    }
    /**
     * Get audit logs for a session
     */
    async getSessionLogs(sessionId) {
        const { data, error } = await supabase
            .from('auth_audit_log')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('[AuditRepository] Failed to get session logs:', error);
            return [];
        }
        return data || [];
    }
}
