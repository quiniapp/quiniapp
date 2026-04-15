class DeviceStatsCache {
  private pending = new Map<string, number>();

  increment(key: string, by = 1): void {
    this.pending.set(key, (this.pending.get(key) ?? 0) + by);
  }

  snapshotAndClear(): Map<string, number> {
    const snapshot = new Map(this.pending);
    this.pending.clear();
    return snapshot;
  }

  size(): number {
    return this.pending.size;
  }
}

export const deviceStatsCache = new DeviceStatsCache();
