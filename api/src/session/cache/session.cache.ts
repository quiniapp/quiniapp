interface SessionCacheEntry {
  user_id: string;
  organization_id: string;
  expires_at: Date;
  created_at: Date;
}

class SessionCache {
  private map = new Map<string, SessionCacheEntry>();

  get(sessionId: string): SessionCacheEntry | undefined {
    return this.map.get(sessionId);
  }

  set(sessionId: string, entry: SessionCacheEntry): void {
    this.map.set(sessionId, entry);
  }

  updateExpiry(sessionId: string, expiresAt: Date): void {
    const entry = this.map.get(sessionId);
    if (entry) entry.expires_at = expiresAt;
  }

  delete(sessionId: string): void {
    this.map.delete(sessionId);
  }

  getSessionIdsByUserId(userId: string): string[] {
    const ids: string[] = [];
    for (const [sessionId, entry] of this.map) {
      if (entry.user_id === userId) ids.push(sessionId);
    }
    return ids;
  }

  getAllIds(): string[] {
    return [...this.map.keys()];
  }
}

export const sessionCache = new SessionCache();
export type { SessionCacheEntry };
