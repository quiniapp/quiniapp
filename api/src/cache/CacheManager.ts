import crypto from 'crypto';

/**
 * Configuration options for a cache entry
 */
export interface CacheConfig {
  /** Time-to-live in milliseconds. If not set, cache never expires by time */
  ttl?: number;
  /** Strategy for generating ETags: 'counter' | 'timestamp' | 'hash' */
  etagStrategy?: 'counter' | 'timestamp' | 'hash';
}

/**
 * Metadata and payload for a cached item
 */
interface CacheEntry<T> {
  payload: T;
  etag: string;
  createdAt: number;
  expiresAt: number | null;
  lastAccessed: number;
  accessCount: number;
  sizeBytes: number;
}

/**
 * Statistics for a specific cache key
 */
export interface CacheStats {
  key: string;
  createdAt: number;
  expiresAt: number | null;
  lastAccessed: number;
  accessCount: number;
  sizeBytes: number;
  timeAliveMs: number;
  etag: string;
}

/**
 * Global cache statistics
 */
export interface GlobalCacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  totalSizeMB: number;
  cacheUptime: number;
  entries: CacheStats[];
}

/**
 * CacheManager: Centralized in-memory cache handler
 *
 * Features:
 * - Multiple cache instances identified by unique keys
 * - Optional TTL (time-to-live) per cache
 * - ETag generation (counter, timestamp, or hash-based)
 * - Statistics: size, access count, uptime, etc.
 * - Automatic invalidation support
 * - Inflight request deduplication
 */
export class CacheManager<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private inflightRequests = new Map<string, Promise<CacheEntry<T>>>();
  private etagCounters = new Map<string, number>();
  private configs = new Map<string, CacheConfig>();
  private readonly startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Get cached data or load it if not present/expired
   * Handles inflight request deduplication
   */
  async getOrLoad<K extends T>(
    key: string,
    loader: () => Promise<K>,
    config?: CacheConfig
  ): Promise<CacheEntry<K>> {
    // Check if cache exists and is valid
    const cached = this.cache.get(key) as CacheEntry<K> | undefined;
    if (cached && this.isValid(cached)) {
      this.updateAccessStats(key);
      return cached;
    }

    // Check if there's already an inflight request for this key
    const inflight = this.inflightRequests.get(key) as Promise<CacheEntry<K>> | undefined;
    if (inflight) {
      return inflight;
    }

    // Create new inflight request
    const loadPromise = this.load(key, loader, config);
    this.inflightRequests.set(key, loadPromise as Promise<CacheEntry<T>>);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.inflightRequests.delete(key);
    }
  }

  /**
   * Load data and cache it
   */
  private async load<K extends T>(
    key: string,
    loader: () => Promise<K>,
    config?: CacheConfig
  ): Promise<CacheEntry<K>> {
    const data = await loader();
    return this.set(key, data, config);
  }

  /**
   * Manually set a cache entry
   */
  set<K extends T>(key: string, data: K, config?: CacheConfig): CacheEntry<K> {
    if (config) {
      this.configs.set(key, config);
    }

    const currentConfig = this.configs.get(key) || {};
    const now = Date.now();
    const sizeBytes = this.estimateSize(data);

    const entry: CacheEntry<K> = {
      payload: data,
      etag: this.generateETag(key, data, currentConfig.etagStrategy),
      createdAt: now,
      expiresAt: currentConfig.ttl ? now + currentConfig.ttl : null,
      lastAccessed: now,
      accessCount: 0,
      sizeBytes,
    };

    this.cache.set(key, entry as CacheEntry<T>);
    return entry;
  }

  /**
   * Get cached data without loading
   */
  get<K extends T>(key: string): CacheEntry<K> | null {
    const cached = this.cache.get(key) as CacheEntry<K> | undefined;
    if (!cached || !this.isValid(cached)) {
      return null;
    }
    this.updateAccessStats(key);
    return cached;
  }

  /**
   * Invalidate (delete) a specific cache entry
   */
  invalidate(key: string): boolean {
    this.inflightRequests.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Invalidate multiple cache entries matching a pattern
   * @param pattern - String to match (simple includes check) or RegExp
   */
  invalidateMatching(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.invalidate(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.inflightRequests.clear();
    this.etagCounters.clear();
    this.configs.clear();
  }

  /**
   * Check if a cache entry is still valid (not expired)
   */
  private isValid<K>(entry: CacheEntry<K>): boolean {
    if (entry.expiresAt === null) {
      return true; // No expiration
    }
    return Date.now() < entry.expiresAt;
  }

  /**
   * Update access statistics for a cache entry
   */
  private updateAccessStats(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      entry.accessCount++;
    }
  }

  /**
   * Generate ETag based on configured strategy
   */
  private generateETag<K>(
    key: string,
    data: K,
    strategy: CacheConfig['etagStrategy'] = 'timestamp'
  ): string {
    switch (strategy) {
      case 'counter': {
        const current = this.etagCounters.get(key) || 0;
        const next = current + 1;
        this.etagCounters.set(key, next);
        return `W/"${key}-${next}"`;
      }
      case 'hash': {
        const dataString = JSON.stringify(data);
        const hash = crypto.createHash('sha1').update(dataString).digest('hex');
        return `W/"${hash}"`;
      }
      case 'timestamp':
      default:
        return `W/"${Date.now()}"`;
    }
  }

  /**
   * Estimate size of data in bytes
   */
  private estimateSize(data: unknown): number {
    const str = JSON.stringify(data);
    // Rough estimation: each char is ~2 bytes in UTF-16
    return str.length * 2;
  }

  /**
   * Get statistics for a specific cache key
   */
  getStats(key: string): CacheStats | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    return {
      key,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      lastAccessed: entry.lastAccessed,
      accessCount: entry.accessCount,
      sizeBytes: entry.sizeBytes,
      timeAliveMs: Date.now() - entry.createdAt,
      etag: entry.etag,
    };
  }

  /**
   * Get global cache statistics
   */
  getGlobalStats(): GlobalCacheStats {
    const entries: CacheStats[] = [];
    let totalSizeBytes = 0;

    for (const key of this.cache.keys()) {
      const stats = this.getStats(key);
      if (stats) {
        entries.push(stats);
        totalSizeBytes += stats.sizeBytes;
      }
    }

    return {
      totalEntries: this.cache.size,
      totalSizeBytes,
      totalSizeMB: totalSizeBytes / (1024 * 1024),
      cacheUptime: Date.now() - this.startTime,
      entries,
    };
  }

  /**
   * Check if a key exists in cache (including expired entries)
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Singleton instance for global use
export const globalCacheManager = new CacheManager();
