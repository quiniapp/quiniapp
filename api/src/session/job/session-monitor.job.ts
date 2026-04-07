import { sessionCache } from '../cache/session.cache';
import { activityCache } from '../cache/session-activity.cache';
import { sseManager } from '../sse/session-sse.manager';
import { SessionRepository } from '../repository/session.repository';

const sessionRepository = new SessionRepository();
const JOB_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export async function flushActivityCache(): Promise<void> {
  const snapshot = activityCache.snapshotAndClear();
  if (snapshot.size === 0) return;

  try {
    await sessionRepository.batchUpdateActivity(snapshot);
    console.log(`[SessionMonitor] Flushed ${snapshot.size} activity entries to DB`);
  } catch (err) {
    console.error('[SessionMonitor] Failed to flush activity cache:', err);
    // Data is lost but server keeps running — next flush will capture new activity
  }
}

async function sessionMonitorJob(): Promise<void> {
  try {
    // 1. Flush activity cache first so DB is up-to-date before we re-read
    await flushActivityCache();

    // 2. Collect all tracked session IDs (cache + SSE connections)
    const allIds = [...new Set([...sessionCache.getAllIds(), ...sseManager.getAllSessionIds()])];
    if (allIds.length === 0) return;

    // 3. Batch fetch from DB
    const sessions = await sessionRepository.getBatchByIds(allIds);
    const sessionMap = new Map(sessions.map((s) => [s.session_id, s]));

    // 4. Process each session
    const now = new Date();
    let expired = 0;

    for (const id of allIds) {
      const session = sessionMap.get(id);
      const isValid = session && session.is_active && now < session.expires_at;

      if (!isValid) {
        sseManager.expire(id);
        sessionCache.delete(id);
        activityCache.delete(id);
        expired++;
      } else {
        // Refresh session cache with latest DB data
        sessionCache.set(id, {
          user_id: session.user_id,
          organization_id: session.organization_id,
          expires_at: session.expires_at,
          created_at: session.created_at,
        });
      }
    }

    // 5. Ping SSE connections to detect dead ones
    sseManager.pingAll();

    console.log(
      `[SessionMonitor] Job done. Tracked: ${allIds.length}, expired: ${expired}, SSE: ${sseManager.size()}`
    );
  } catch (err) {
    console.error('[SessionMonitor] Job failed:', err);
  }
}

export function startSessionMonitorJob(): void {
  setInterval(() => void sessionMonitorJob(), JOB_INTERVAL_MS);
  console.log('[SessionMonitor] Background job started (interval: 30 min)');
}
