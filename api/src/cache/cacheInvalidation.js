import { globalCacheManager } from './CacheManager';
/**
 * Organization-scoped cache key generators
 * These ensure cache isolation between different organizations
 */
export function getLotteryCacheKey(organization_id, all) {
    return `org:${organization_id}:lotteries:all=${all}`;
}
export function getScheduleCacheKey(organization_id, all) {
    return `org:${organization_id}:schedules:all=${all}`;
}
export function getScheduleLotteryCacheKey(organization_id) {
    return `org:${organization_id}:schedule-lotteries:all`;
}
/**
 * Granular invalidation functions (organization-specific)
 * These invalidate specific cache entries for a given organization
 */
export function invalidateLotteriesForOrg(organization_id) {
    globalCacheManager.invalidate(getLotteryCacheKey(organization_id, true));
    globalCacheManager.invalidate(getLotteryCacheKey(organization_id, false));
}
export function invalidateSchedulesForOrg(organization_id) {
    globalCacheManager.invalidate(getScheduleCacheKey(organization_id, true));
    globalCacheManager.invalidate(getScheduleCacheKey(organization_id, false));
}
export function invalidateScheduleLotteriesForOrg(organization_id) {
    globalCacheManager.invalidate(getScheduleLotteryCacheKey(organization_id));
}
/**
 * Cascade invalidation functions for related entities
 * These handle complex relationships between lotteries, schedules, and schedule-lotteries
 */
/**
 * When lottery changes: invalidate lotteries + scheduleLotteries
 * Reasoning: Schedules may reference the new/updated lottery
 */
export function invalidateLotteryRelated(organization_id) {
    invalidateLotteriesForOrg(organization_id);
    invalidateScheduleLotteriesForOrg(organization_id);
}
/**
 * When schedule changes: invalidate schedules + scheduleLotteries + lotteries
 * Reasoning: Schedule changes may affect lottery active status and availability
 */
export function invalidateScheduleRelated(organization_id) {
    invalidateSchedulesForOrg(organization_id);
    invalidateScheduleLotteriesForOrg(organization_id);
    invalidateLotteriesForOrg(organization_id);
}
/**
 * When scheduleLottery changes: invalidate all three
 * Reasoning: This affects lottery active status and schedule availability
 */
export function invalidateScheduleLotteryRelated(organization_id) {
    invalidateScheduleLotteriesForOrg(organization_id);
    invalidateLotteriesForOrg(organization_id);
    invalidateSchedulesForOrg(organization_id);
}
/**
 * Nuclear option: invalidate all caches for an organization
 * Use when you need to ensure complete cache refresh
 */
export function invalidateAllForOrg(organization_id) {
    invalidateLotteriesForOrg(organization_id);
    invalidateSchedulesForOrg(organization_id);
    invalidateScheduleLotteriesForOrg(organization_id);
}
/**
 * Pattern-based invalidation for debugging/admin purposes
 * Returns the number of cache entries invalidated
 */
export function invalidateAllCachesForOrganization(organization_id) {
    return globalCacheManager.invalidateMatching(`^org:${organization_id}:`);
}
