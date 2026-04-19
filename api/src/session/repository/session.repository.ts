import { supabase } from '@database/db.connection';
import { InternalServerError } from '@helper/errors';
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
   * Atomically enforce concurrent session limit then create a new session.
   * Uses FOR UPDATE inside a single Postgres transaction to prevent TOCTOU.
   */
  async createWithLimit(
    params: ICreateSessionParams,
    maxSessions: number,
    expiresAt: Date
  ): Promise<ISession> {
    const { data, error } = await supabase
      .rpc('create_session_with_limit', {
        p_user_id: params.user_id,
        p_organization_id: params.organization_id,
        p_refresh_token_hash: params.refresh_token_hash,
        p_ip_address: params.ip_address || null,
        p_user_agent: params.user_agent || null,
        p_max_sessions: maxSessions,
        p_expires_at: expiresAt.toISOString(),
      })
      .single();

    if (error || !data) {
      console.error('[SessionRepository] Failed to create session with limit:', error);
      throw new InternalServerError('Failed to create session');
    }

    return this.mapToSession(data as Record<string, unknown>);
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
  async updateActivity(sessionId: string, createdAt: Date): Promise<void> {
    const now = new Date();

    // Calculate new expiration with sliding window
    const newExpiry = new Date(now.getTime() + SESSION_CONFIG.INACTIVITY_TIMEOUT);

    // Respect absolute timeout
    const absoluteEnd = new Date(createdAt.getTime() + SESSION_CONFIG.ABSOLUTE_TIMEOUT);

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
  async rotateRefreshToken(
    sessionId: string,
    newRefreshTokenHash: string,
    newVersion: number
  ): Promise<void> {
    const { error } = await supabase
      .from('sessions')
      .update({
        refresh_token_hash: newRefreshTokenHash,
        refresh_token_version: newVersion,
      })
      .eq('session_id', sessionId);

    if (error) {
      console.error('[SessionRepository] Failed to rotate refresh token:', error);
      throw new InternalServerError('Failed to rotate refresh token');
    }
  }

  /**
   * Get multiple sessions by IDs in a single query
   */
  async getBatchByIds(sessionIds: string[]): Promise<ISession[]> {
    if (sessionIds.length === 0) return [];

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .in('session_id', sessionIds);

    if (error) {
      console.error('[SessionRepository] Failed to batch get sessions:', error);
      throw new InternalServerError('Failed to batch get sessions');
    }

    return (data || []).map(this.mapToSession);
  }

  /**
   * Batch update session activity from in-memory cache flush.
   * Uses a single Postgres function call regardless of the number of sessions.
   */
  async batchUpdateActivity(
    entries: Map<string, { last_activity_at: Date; expires_at: Date }>
  ): Promise<void> {
    if (entries.size === 0) return;

    const sessionIds: string[] = [];
    const activityTimes: string[] = [];
    const expiryTimes: string[] = [];

    for (const [sessionId, entry] of entries) {
      sessionIds.push(sessionId);
      activityTimes.push(entry.last_activity_at.toISOString());
      expiryTimes.push(entry.expires_at.toISOString());
    }

    const { error } = await supabase.rpc('batch_update_session_activity', {
      p_session_ids: sessionIds,
      p_activity_times: activityTimes,
      p_expiry_times: expiryTimes,
    });

    if (error) {
      console.error('[SessionRepository] Failed to batch update activity:', error);
      throw new InternalServerError('Failed to batch update session activity');
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
      session_id: data.session_id as string,
      user_id: data.user_id as string,
      organization_id: data.organization_id as string,
      refresh_token_hash: data.refresh_token_hash as string,
      refresh_token_version: data.refresh_token_version as number,
      ip_address: (data.ip_address as string) || null,
      user_agent: (data.user_agent as string) || null,
      device_fingerprint: (data.device_fingerprint as string) || null,
      created_at: new Date(data.created_at as string),
      last_activity_at: new Date(data.last_activity_at as string),
      expires_at: new Date(data.expires_at as string),
      is_active: data.is_active as boolean,
      revoked_at: data.revoked_at ? new Date(data.revoked_at as string) : null,
      revoked_reason: (data.revoked_reason as string) || null,
    };
  }
}
