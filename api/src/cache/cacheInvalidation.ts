import { SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';

import { globalCacheManager } from './CacheManager';

/**
 * Organization-scoped cache key generators
 * These ensure cache isolation between different organizations
 */

export function getLotteryCacheKey(organization_id: string, all: boolean): string {
  return `org:${organization_id}:lotteries:all=${all}`;
}

export function getLotteryDayCacheKey(
  organization_id: string,
  day: SCHEDULE_DAY,
  all: boolean
): string {
  return `org:${organization_id}:lotteries:day=${day}:all=${all}`;
}

export function getScheduleCacheKey(organization_id: string, all: boolean): string {
  return `org:${organization_id}:schedules:all=${all}`;
}

export function getScheduleDayCacheKey(
  organization_id: string,
  day: SCHEDULE_DAY,
  all: boolean,
  withLotteries: boolean
): string {
  return `org:${organization_id}:schedules:day=${day}:all=${all}:wl=${withLotteries}`;
}

export function getScheduleLotteryCacheKey(organization_id: string): string {
  return `org:${organization_id}:schedule-lotteries:all`;
}

/**
 * Granular invalidation functions (organization-specific)
 * These invalidate specific cache entries for a given organization
 */

export function invalidateLotteriesForOrg(organization_id: string): void {
  globalCacheManager.invalidate(getLotteryCacheKey(organization_id, true));
  globalCacheManager.invalidate(getLotteryCacheKey(organization_id, false));
  globalCacheManager.invalidateMatching(`^org:${organization_id}:lotteries:day=`);
}

export function invalidateSchedulesForOrg(organization_id: string): void {
  globalCacheManager.invalidate(getScheduleCacheKey(organization_id, true));
  globalCacheManager.invalidate(getScheduleCacheKey(organization_id, false));
  globalCacheManager.invalidateMatching(`^org:${organization_id}:schedules:day=`);
}

export function invalidateScheduleLotteriesForOrg(organization_id: string): void {
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
export function invalidateLotteryRelated(organization_id: string): void {
  invalidateLotteriesForOrg(organization_id);
  invalidateScheduleLotteriesForOrg(organization_id);
}

/**
 * When schedule changes: invalidate schedules + scheduleLotteries + lotteries
 * Reasoning: Schedule changes may affect lottery active status and availability
 */
export function invalidateScheduleRelated(organization_id: string): void {
  invalidateSchedulesForOrg(organization_id);
  invalidateScheduleLotteriesForOrg(organization_id);
  invalidateLotteriesForOrg(organization_id);
}

/**
 * When scheduleLottery changes: invalidate all three
 * Reasoning: This affects lottery active status and schedule availability
 */
export function invalidateScheduleLotteryRelated(organization_id: string): void {
  invalidateScheduleLotteriesForOrg(organization_id);
  invalidateLotteriesForOrg(organization_id);
  invalidateSchedulesForOrg(organization_id);
}

/**
 * Invalidate org network IDs cache.
 * Call when an organization is created or deleted.
 * The ancestor org's cache must be invalidated since its descendants changed.
 */
export function invalidateOrgNetworkIds(organization_id: string): void {
  globalCacheManager.invalidate(`org:${organization_id}:network-ids`);
}

// ====== Organization cache keys ======

export function getOrganizationAllCacheKey(): string {
  return 'organizations:all';
}

export function getOrganizationChildrenCacheKey(parentOrgId: string): string {
  return `org:${parentOrgId}:children`;
}

export function invalidateOrganizations(): void {
  globalCacheManager.invalidate(getOrganizationAllCacheKey());
  globalCacheManager.invalidateMatching(/^org:[^:]+:children$/);
}

/**
 * Nuclear option: invalidate all caches for an organization
 * Use when you need to ensure complete cache refresh
 */
export function invalidateAllForOrg(organization_id: string): void {
  invalidateLotteriesForOrg(organization_id);
  invalidateSchedulesForOrg(organization_id);
  invalidateScheduleLotteriesForOrg(organization_id);
  invalidateOrgNetworkIds(organization_id);
  invalidateOrganizations();
}

/**
 * Pattern-based invalidation for debugging/admin purposes
 * Returns the number of cache entries invalidated
 */
export function invalidateAllCachesForOrganization(organization_id: string): number {
  return globalCacheManager.invalidateMatching(`^org:${organization_id}:`);
}
