import { deviceStatsCache } from '../cache/device-stats.cache';
import { clientStatsCache } from '../cache/client-stats.cache';
import { DeviceStatsRepository } from '../repository/device-stats.repository';

const repository = new DeviceStatsRepository();
const JOB_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function flushDeviceStats(): Promise<void> {
  const deviceSnapshot = deviceStatsCache.snapshotAndClear();
  const clientSnapshot = clientStatsCache.snapshotAndClear();

  if (deviceSnapshot.size === 0 && clientSnapshot.length === 0) return;

  const results = await Promise.allSettled([
    deviceSnapshot.size > 0 ? repository.batchUpsert(deviceSnapshot) : Promise.resolve(),
    clientSnapshot.length > 0 ? repository.batchUpsertClient(clientSnapshot) : Promise.resolve(),
  ]);

  if (results[0].status === 'fulfilled' && deviceSnapshot.size > 0) {
    console.log(`[DeviceStats] Flushed ${deviceSnapshot.size} stat entries to DB`);
  } else if (results[0].status === 'rejected') {
    console.error('[DeviceStats] Failed to flush device stats:', results[0].reason);
  }

  if (results[1].status === 'fulfilled' && clientSnapshot.length > 0) {
    console.log(`[DeviceStats] Flushed ${clientSnapshot.length} client stat entries to DB`);
  } else if (results[1].status === 'rejected') {
    console.error('[DeviceStats] Failed to flush client stats:', results[1].reason);
  }
}

export function startDeviceStatsJob(): void {
  setInterval(() => void flushDeviceStats(), JOB_INTERVAL_MS);
  console.log('[DeviceStats] Background job started (interval: 6h)');
}
