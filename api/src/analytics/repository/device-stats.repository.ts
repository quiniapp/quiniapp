import { supabase } from '@database/db.connection';
import { InternalServerError } from '@helper/errors';
import { ClientInfo } from '../helper/device-detector';

export class DeviceStatsRepository {
  async batchUpsert(entries: Map<string, number>): Promise<void> {
    if (entries.size === 0) return;

    const keys: string[] = [];
    const counts: number[] = [];

    for (const [key, count] of entries) {
      keys.push(key);
      counts.push(count);
    }

    const { error } = await supabase.rpc('upsert_device_stats', {
      p_keys: keys,
      p_counts: counts,
    });

    if (error) {
      console.error('[DeviceStatsRepository] Failed to upsert device stats:', error);
      throw new InternalServerError('Failed to upsert device stats');
    }
  }

  async batchUpsertClient(entries: Array<{ info: ClientInfo; count: number }>): Promise<void> {
    if (entries.length === 0) return;

    const { error } = await supabase.rpc('upsert_client_stats', {
      p_vendors: entries.map((e) => e.info.device_vendor),
      p_models: entries.map((e) => e.info.device_model),
      p_os_names: entries.map((e) => e.info.os_name),
      p_os_versions: entries.map((e) => e.info.os_version),
      p_browsers: entries.map((e) => e.info.browser_name),
      p_browser_majors: entries.map((e) => e.info.browser_major),
      p_counts: entries.map((e) => e.count),
    });

    if (error) {
      console.error('[DeviceStatsRepository] Failed to upsert client stats:', error);
      throw new InternalServerError('Failed to upsert client stats');
    }
  }
}
