import { SESSION_CONFIG } from 'api/src/config/session.config';

export interface ActivityCacheEntry {
  last_activity_at: Date;
  expires_at: Date;
}

class SessionActivityCache {
  private map = new Map<string, ActivityCacheEntry>();

  /**
   * Marks activity for a session. Returns the new expires_at.
   */
  mark(sessionId: string, createdAt: Date): Date {
    const now = new Date();
    const newExpiry = new Date(now.getTime() + SESSION_CONFIG.INACTIVITY_TIMEOUT);
    const absoluteEnd = new Date(createdAt.getTime() + SESSION_CONFIG.ABSOLUTE_TIMEOUT);
    const expires_at = newExpiry < absoluteEnd ? newExpiry : absoluteEnd;

    this.map.set(sessionId, { last_activity_at: now, expires_at });
    return expires_at;
  }

  get(sessionId: string): ActivityCacheEntry | undefined {
    return this.map.get(sessionId);
  }

  delete(sessionId: string): void {
    this.map.delete(sessionId);
  }

  /**
   * Returns a copy of the map for flushing to DB, then clears the original.
   */
  snapshotAndClear(): Map<string, ActivityCacheEntry> {
    const snapshot = new Map(this.map);
    this.map.clear();
    return snapshot;
  }

  getAllIds(): string[] {
    return [...this.map.keys()];
  }

  size(): number {
    return this.map.size;
  }
}

export const activityCache = new SessionActivityCache();
