import { BACKUP_HEALTH_URL } from 'api/envs';

/**
 * Keep-Warm Job
 *
 * The Render free tier sleeps after ~15 min without inbound traffic (cold start ~50s).
 * To keep the backup instance warm, the main (Railway) instance pings its /health endpoint
 * periodically. Gated by ENABLE_BACKGROUND_JOBS (only the main instance runs it).
 *
 * Failures are swallowed (the backup may legitimately be down) — they must never crash main.
 */

// Ping every 10 minutes — comfortably under Render's ~15 min idle-to-sleep window.
const KEEP_WARM_INTERVAL_MS = 10 * 60 * 1000;

// Abort the ping if the backup doesn't answer quickly; a cold backup can take ~50s and we
// don't want a hung request piling up.
const PING_TIMEOUT_MS = 30 * 1000;

let keepWarmIntervalId: ReturnType<typeof setInterval> | null = null;

async function pingBackup(): Promise<void> {
  if (!BACKUP_HEALTH_URL) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

  try {
    const res = await fetch(BACKUP_HEALTH_URL, { method: 'GET', signal: controller.signal });
    if (!res.ok) {
      console.warn(`[KeepWarm] ⚠️  Backup responded ${res.status} at ${BACKUP_HEALTH_URL}`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[KeepWarm] ⚠️  Could not reach backup (${reason})`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Start pinging the backup instance to keep it warm.
 * No-op when BACKUP_HEALTH_URL is unset.
 */
export function startKeepWarmJob(): void {
  if (!BACKUP_HEALTH_URL) {
    console.log('[KeepWarm] BACKUP_HEALTH_URL not set — keep-warm disabled');
    return;
  }
  if (keepWarmIntervalId) {
    console.warn('[KeepWarm] ⚠️  Job already running, skipping start');
    return;
  }

  console.log(
    `[KeepWarm] 🔥 Pinging backup every ${KEEP_WARM_INTERVAL_MS / 1000 / 60} min: ${BACKUP_HEALTH_URL}`
  );

  // Ping once on start, then on the interval.
  void pingBackup();
  keepWarmIntervalId = setInterval(() => {
    void pingBackup();
  }, KEEP_WARM_INTERVAL_MS);
}

/**
 * Stop the keep-warm job (graceful shutdown).
 */
export function stopKeepWarmJob(): void {
  if (keepWarmIntervalId) {
    clearInterval(keepWarmIntervalId);
    keepWarmIntervalId = null;
    console.log('[KeepWarm] 🛑 Keep-warm job stopped');
  }
}
