export interface ICreateAuditLogParams {
  user_id?: string;
  session_id?: string;
  organization_id?: string;
  event_type: string;
  ip_address?: string;
  user_agent?: string;
  username?: string;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, string | number | boolean>;
}
export declare class AuditRepository {
  /**
   * Log an authentication/session event
   */
  log(params: ICreateAuditLogParams): Promise<void>;
  /**
   * Get recent failed login attempts for a username (for brute force detection)
   */
  getRecentFailedAttempts(username: string, windowMinutes?: number): Promise<number>;
  /**
   * Get recent failed login attempts by IP address
   */
  getRecentFailedAttemptsByIP(ipAddress: string, windowMinutes?: number): Promise<number>;
  /**
   * Get audit logs for a user
   */
  getUserLogs(userId: string, limit?: number): Promise<Record<string, unknown>[]>;
  /**
   * Get audit logs for a session
   */
  getSessionLogs(sessionId: string): Promise<Record<string, unknown>[]>;
}
