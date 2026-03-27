/**
 * Organization-scoped cache key generators
 * These ensure cache isolation between different organizations
 */
export declare function getLotteryCacheKey(organization_id: string, all: boolean): string;
export declare function getScheduleCacheKey(organization_id: string, all: boolean): string;
export declare function getScheduleLotteryCacheKey(organization_id: string): string;
/**
 * Granular invalidation functions (organization-specific)
 * These invalidate specific cache entries for a given organization
 */
export declare function invalidateLotteriesForOrg(organization_id: string): void;
export declare function invalidateSchedulesForOrg(organization_id: string): void;
export declare function invalidateScheduleLotteriesForOrg(organization_id: string): void;
/**
 * Cascade invalidation functions for related entities
 * These handle complex relationships between lotteries, schedules, and schedule-lotteries
 */
/**
 * When lottery changes: invalidate lotteries + scheduleLotteries
 * Reasoning: Schedules may reference the new/updated lottery
 */
export declare function invalidateLotteryRelated(organization_id: string): void;
/**
 * When schedule changes: invalidate schedules + scheduleLotteries + lotteries
 * Reasoning: Schedule changes may affect lottery active status and availability
 */
export declare function invalidateScheduleRelated(organization_id: string): void;
/**
 * When scheduleLottery changes: invalidate all three
 * Reasoning: This affects lottery active status and schedule availability
 */
export declare function invalidateScheduleLotteryRelated(organization_id: string): void;
/**
 * Nuclear option: invalidate all caches for an organization
 * Use when you need to ensure complete cache refresh
 */
export declare function invalidateAllForOrg(organization_id: string): void;
/**
 * Pattern-based invalidation for debugging/admin purposes
 * Returns the number of cache entries invalidated
 */
export declare function invalidateAllCachesForOrganization(organization_id: string): number;
