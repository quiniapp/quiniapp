import crypto from 'crypto';
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
export class CacheManager {
    constructor() {
        this.cache = new Map();
        this.inflightRequests = new Map();
        this.etagCounters = new Map();
        this.configs = new Map();
        this.startTime = Date.now();
    }
    /**
     * Get cached data or load it if not present/expired
     * Handles inflight request deduplication
     */
    async getOrLoad(key, loader, config) {
        // Check if cache exists and is valid
        const cached = this.cache.get(key);
        if (cached && this.isValid(cached)) {
            this.updateAccessStats(key);
            return cached;
        }
        // Check if there's already an inflight request for this key
        const inflight = this.inflightRequests.get(key);
        if (inflight) {
            return inflight;
        }
        // Create new inflight request
        const loadPromise = this.load(key, loader, config);
        this.inflightRequests.set(key, loadPromise);
        try {
            const result = await loadPromise;
            return result;
        }
        finally {
            this.inflightRequests.delete(key);
        }
    }
    /**
     * Load data and cache it
     */
    async load(key, loader, config) {
        const data = await loader();
        return this.set(key, data, config);
    }
    /**
     * Manually set a cache entry
     */
    set(key, data, config) {
        if (config) {
            this.configs.set(key, config);
        }
        const currentConfig = this.configs.get(key) || {};
        const now = Date.now();
        const sizeBytes = this.estimateSize(data);
        const entry = {
            payload: data,
            etag: this.generateETag(key, data, currentConfig.etagStrategy),
            createdAt: now,
            expiresAt: currentConfig.ttl ? now + currentConfig.ttl : null,
            lastAccessed: now,
            accessCount: 0,
            sizeBytes,
        };
        this.cache.set(key, entry);
        return entry;
    }
    /**
     * Get cached data without loading
     */
    get(key) {
        const cached = this.cache.get(key);
        if (!cached || !this.isValid(cached)) {
            return null;
        }
        this.updateAccessStats(key);
        return cached;
    }
    /**
     * Invalidate (delete) a specific cache entry
     */
    invalidate(key) {
        this.inflightRequests.delete(key);
        return this.cache.delete(key);
    }
    /**
     * Invalidate multiple cache entries matching a pattern
     * @param pattern - String to match (simple includes check) or RegExp
     */
    invalidateMatching(pattern) {
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
    clear() {
        this.cache.clear();
        this.inflightRequests.clear();
        this.etagCounters.clear();
        this.configs.clear();
    }
    /**
     * Check if a cache entry is still valid (not expired)
     */
    isValid(entry) {
        if (entry.expiresAt === null) {
            return true; // No expiration
        }
        return Date.now() < entry.expiresAt;
    }
    /**
     * Update access statistics for a cache entry
     */
    updateAccessStats(key) {
        const entry = this.cache.get(key);
        if (entry) {
            entry.lastAccessed = Date.now();
            entry.accessCount++;
        }
    }
    /**
     * Generate ETag based on configured strategy
     */
    generateETag(key, data, strategy = 'timestamp') {
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
    estimateSize(data) {
        const str = JSON.stringify(data);
        // Rough estimation: each char is ~2 bytes in UTF-16
        return str.length * 2;
    }
    /**
     * Get statistics for a specific cache key
     */
    getStats(key) {
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
    getGlobalStats() {
        const entries = [];
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
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Get all cache keys
     */
    keys() {
        return Array.from(this.cache.keys());
    }
}
// Singleton instance for global use
export const globalCacheManager = new CacheManager();
