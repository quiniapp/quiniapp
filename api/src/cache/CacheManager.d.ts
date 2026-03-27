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
export declare class CacheManager<T = unknown> {
  private cache;
  private inflightRequests;
  private etagCounters;
  private configs;
  private readonly startTime;
  constructor();
  /**
   * Get cached data or load it if not present/expired
   * Handles inflight request deduplication
   */
  getOrLoad<K extends T>(
    key: string,
    loader: () => Promise<K>,
    config?: CacheConfig
  ): Promise<CacheEntry<K>>;
  /**
   * Load data and cache it
   */
  private load;
  /**
   * Manually set a cache entry
   */
  set<K extends T>(key: string, data: K, config?: CacheConfig): CacheEntry<K>;
  /**
   * Get cached data without loading
   */
  get<K extends T>(key: string): CacheEntry<K> | null;
  /**
   * Invalidate (delete) a specific cache entry
   */
  invalidate(key: string): boolean;
  /**
   * Invalidate multiple cache entries matching a pattern
   * @param pattern - String to match (simple includes check) or RegExp
   */
  invalidateMatching(pattern: string | RegExp): number;
  /**
   * Clear all cache entries
   */
  clear(): void;
  /**
   * Check if a cache entry is still valid (not expired)
   */
  private isValid;
  /**
   * Update access statistics for a cache entry
   */
  private updateAccessStats;
  /**
   * Generate ETag based on configured strategy
   */
  private generateETag;
  /**
   * Estimate size of data in bytes
   */
  private estimateSize;
  /**
   * Get statistics for a specific cache key
   */
  getStats(key: string): CacheStats | null;
  /**
   * Get global cache statistics
   */
  getGlobalStats(): GlobalCacheStats;
  /**
   * Check if a key exists in cache (including expired entries)
   */
  has(key: string): boolean;
  /**
   * Get all cache keys
   */
  keys(): string[];
}
export declare const globalCacheManager: CacheManager<unknown>;
export {};
