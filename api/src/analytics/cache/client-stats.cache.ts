import { ClientInfo } from '../helper/device-detector';

const SEP = '|||';

class ClientStatsCache {
  private pending = new Map<string, number>();

  increment(info: ClientInfo, by = 1): void {
    const key = [
      info.device_vendor,
      info.device_model,
      info.os_name,
      info.os_version,
      info.browser_name,
      info.browser_major,
    ].join(SEP);
    this.pending.set(key, (this.pending.get(key) ?? 0) + by);
  }

  snapshotAndClear(): Array<{ info: ClientInfo; count: number }> {
    const result: Array<{ info: ClientInfo; count: number }> = [];
    for (const [key, count] of this.pending) {
      const [device_vendor, device_model, os_name, os_version, browser_name, browser_major] =
        key.split(SEP);
      result.push({
        info: { device_vendor, device_model, os_name, os_version, browser_name, browser_major },
        count,
      });
    }
    this.pending.clear();
    return result;
  }

  size(): number {
    return this.pending.size;
  }
}

export const clientStatsCache = new ClientStatsCache();
