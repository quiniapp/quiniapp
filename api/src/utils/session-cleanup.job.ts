import { SessionRepository } from '../session/repository/session.repository';
import { SESSION_CONFIG } from '../config/session.config';

/**
 * Session Cleanup Job
 * Periodically marks expired sessions as inactive in the database
 *
 * Runs every hour (configurable via CLEANUP_INTERVAL_MS)
 * Uses the cleanup_expired_sessions() PostgreSQL function for efficiency
 */

const sessionRepository = new SessionRepository();

// Cleanup interval: 1 hour
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Cleanup expired sessions
 * Calls the database function to mark expired sessions as inactive
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const count = await sessionRepository.cleanupExpiredSessions();

    if (count > 0) {
      console.log(`[SessionCleanup] ✅ Cleaned up ${count} expired sessions`);
    } else {
      console.log('[SessionCleanup] No expired sessions to clean up');
    }

    return count;
  } catch (error) {
    console.error('[SessionCleanup] ❌ Error cleaning up sessions:', error);
    // Don't throw - cleanup failures shouldn't crash the server
    return 0;
  }
}

/**
 * Start the session cleanup job
 * Runs cleanup immediately, then every CLEANUP_INTERVAL_MS
 */
export function startSessionCleanupJob(): void {
  if (cleanupIntervalId) {
    console.warn('[SessionCleanup] ⚠️  Job already running, skipping start');
    return;
  }

  console.log('[SessionCleanup] 🚀 Starting session cleanup job');
  console.log(`[SessionCleanup] Cleanup interval: ${CLEANUP_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(
    `[SessionCleanup] Inactivity timeout: ${SESSION_CONFIG.INACTIVITY_TIMEOUT / 1000 / 60 / 60} hours`
  );
  console.log(
    `[SessionCleanup] Absolute timeout: ${SESSION_CONFIG.ABSOLUTE_TIMEOUT / 1000 / 60 / 60 / 24} days\n`
  );

  // Run cleanup immediately on start
  void cleanupExpiredSessions();

  // Schedule periodic cleanup
  cleanupIntervalId = setInterval(() => {
    void cleanupExpiredSessions();
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the session cleanup job
 * Useful for graceful shutdown
 */
export function stopSessionCleanupJob(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log('[SessionCleanup] 🛑 Session cleanup job stopped');
  }
}

/**
 * Get job status
 */
export function isCleanupJobRunning(): boolean {
  return cleanupIntervalId !== null;
}
