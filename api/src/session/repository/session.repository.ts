import { supabase } from '@database/db.connection';
import { InternalServerError, UnauthorizedError } from '@helper/errors';
import { SESSION_CONFIG } from '../../config/session.config';

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

export class SessionRepository {
  /**
   * Create a new session
   */
  async create(params: ICreateSessionParams): Promise<ISession> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_CONFIG.INACTIVITY_TIMEOUT);

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: params.user_id,
        organization_id: params.organization_id,
        refresh_token_hash: params.refresh_token_hash,
        refresh_token_version: 1,
        ip_address: params.ip_address || null,
        user_agent: params.user_agent || null,
        device_fingerprint: params.device_fingerprint || null,
        created_at: now.toISOString(),
        last_activity_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[SessionRepository] Failed to create session:', error);
      throw new InternalServerError('Failed to create session');
    }

    return this.mapToSession(data);
  }

  /**
   * Get session by ID
   */
  async getById(sessionId: string): Promise<ISession | null> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;
    return this.mapToSession(data);
  }

  /**
   * Update session activity (sliding window)
   */
  async updateActivity(sessionId: string): Promise<void> {
    const session = await this.getById(sessionId);
    if (!session) throw new UnauthorizedError('Invalid session');

    const now = new Date();

    // Calculate new expiration with sliding window
    const newExpiry = new Date(now.getTime() + SESSION_CONFIG.INACTIVITY_TIMEOUT);

    // Respect absolute timeout
    const absoluteEnd = new Date(session.created_at.getTime() + SESSION_CONFIG.ABSOLUTE_TIMEOUT);

    const finalExpiry = newExpiry > absoluteEnd ? absoluteEnd : newExpiry;

    const { error } = await supabase
      .from('sessions')
      .update({
        last_activity_at: now.toISOString(),
        expires_at: finalExpiry.toISOString(),
      })
      .eq('session_id', sessionId);

    if (error) {
      console.error('[SessionRepository] Failed to update session activity:', error);
      throw new InternalServerError('Failed to update session activity');
    }
  }

  /**
   * Revoke a session
   */
  async revoke(sessionId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_reason: reason,
      })
      .eq('session_id', sessionId);

    if (error) {
      console.error('[SessionRepository] Failed to revoke session:', error);
      throw new InternalServerError('Failed to revoke session');
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('sessions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_reason: reason,
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('[SessionRepository] Failed to revoke user sessions:', error);
      throw new InternalServerError('Failed to revoke user sessions');
    }
  }

  /**
   * Count active sessions for a user
   */
  async countActiveSessions(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('[SessionRepository] Failed to count sessions:', error);
      throw new InternalServerError('Failed to count sessions');
    }

    return count || 0;
  }

  /**
   * Revoke oldest session for a user (for concurrent session limit)
   */
  async revokeOldestSession(userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('sessions')
      .select('session_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) return;

    await this.revoke(data.session_id, 'max_concurrent_sessions_exceeded');
  }

  /**
   * Rotate refresh token (for security)
   */
  async rotateRefreshToken(sessionId: string, newRefreshTokenHash: string): Promise<void> {
    const session = await this.getById(sessionId);
    if (!session) throw new UnauthorizedError('Invalid session');

    const { error } = await supabase
      .from('sessions')
      .update({
        refresh_token_hash: newRefreshTokenHash,
        refresh_token_version: session.refresh_token_version + 1,
      })
      .eq('session_id', sessionId);

    if (error) {
      console.error('[SessionRepository] Failed to rotate refresh token:', error);
      throw new InternalServerError('Failed to rotate refresh token');
    }
  }

  /**
   * Cleanup expired sessions (called periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const { data, error } = await supabase.rpc('cleanup_expired_sessions');

    if (error) {
      console.error('[SessionRepository] Failed to cleanup expired sessions:', error);
      return 0;
    }

    return data || 0;
  }

  /**
   * Get all active sessions for a user (for "manage devices" feature)
   */
  async getUserSessions(userId: string): Promise<ISession[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false });

    if (error) {
      console.error('[SessionRepository] Failed to get user sessions:', error);
      throw new InternalServerError('Failed to get user sessions');
    }

    return (data || []).map(this.mapToSession);
  }

  /**
   * Map database row to ISession interface
   */
  private mapToSession(data: Record<string, unknown>): ISession {
    return {
      session_id: data.session_id,
      user_id: data.user_id,
      organization_id: data.organization_id,
      refresh_token_hash: data.refresh_token_hash,
      refresh_token_version: data.refresh_token_version,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      device_fingerprint: data.device_fingerprint,
      created_at: new Date(data.created_at),
      last_activity_at: new Date(data.last_activity_at),
      expires_at: new Date(data.expires_at),
      is_active: data.is_active,
      revoked_at: data.revoked_at ? new Date(data.revoked_at) : null,
      revoked_reason: data.revoked_reason,
    };
  }
}
