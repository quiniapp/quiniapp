export interface ISession {
  session_id: string;
  user_id: string;
  organization_id: string;
  refresh_token_hash: string;
  refresh_token_version: number;
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  created_at: Date;
  last_activity_at: Date;
  expires_at: Date;
  is_active: boolean;
  revoked_at: Date | null;
  revoked_reason: string | null;
}
export interface ICreateSessionParams {
  user_id: string;
  organization_id: string;
  refresh_token_hash: string;
  ip_address?: string;
  user_agent?: string;
  device_fingerprint?: string;
}
export declare class SessionRepository {
  /**
   * Create a new session
   */
  create(params: ICreateSessionParams): Promise<ISession>;
  /**
   * Get session by ID
   */
  getById(sessionId: string): Promise<ISession | null>;
  /**
   * Update session activity (sliding window)
   */
  updateActivity(sessionId: string): Promise<void>;
  /**
   * Revoke a session
   */
  revoke(sessionId: string, reason: string): Promise<void>;
  /**
   * Revoke all sessions for a user
   */
  revokeAllUserSessions(userId: string, reason: string): Promise<void>;
  /**
   * Count active sessions for a user
   */
  countActiveSessions(userId: string): Promise<number>;
  /**
   * Revoke oldest session for a user (for concurrent session limit)
   */
  revokeOldestSession(userId: string): Promise<void>;
  /**
   * Rotate refresh token (for security)
   */
  rotateRefreshToken(sessionId: string, newRefreshTokenHash: string): Promise<void>;
  /**
   * Cleanup expired sessions (called periodically)
   */
  cleanupExpiredSessions(): Promise<number>;
  /**
   * Get all active sessions for a user (for "manage devices" feature)
   */
  getUserSessions(userId: string): Promise<ISession[]>;
  /**
   * Map database row to ISession interface
   */
  private mapToSession;
}
