import { ActivityDaysRepository } from '../../activity/repository/activity-days.repository';

/**
 * In-memory cache of last N active days
 * Updated when cron job runs (only time data moves between tables)
 */
let cachedActiveDays: string[] = [];
let lastCacheUpdate: Date | null = null;

/**
 * Get days to keep from environment variable
 * Defaults to 2 if not set
 */
const getDaysToKeep = (): number => {
  const envValue = process.env.ARCHIVE_DAYS_TO_KEEP;
  return envValue ? parseInt(envValue, 10) : 2;
};

/**
 * Initialize the cache of active days
 * Should be called on server startup
 */
export async function initializeActiveDaysCache(): Promise<void> {
  try {
    const activityRepo = new ActivityDaysRepository();
    const daysToKeep = getDaysToKeep();

    const activeDays = await activityRepo.getLastActiveDays(daysToKeep);
    cachedActiveDays = activeDays;
    lastCacheUpdate = new Date();

    console.log(
      `[ArchiveHelper] Cache initialized with ${activeDays.length} active days:`,
      activeDays
    );
  } catch (error) {
    console.error('[ArchiveHelper] Failed to initialize cache:', error);
    // Set empty cache on error - better to query main table than fail
    cachedActiveDays = [];
    lastCacheUpdate = new Date();
  }
}

/**
 * Refresh the cache of active days
 * Called by cron job after archiving operation completes
 */
export async function refreshActiveDaysCache(): Promise<void> {
  try {
    const activityRepo = new ActivityDaysRepository();
    const daysToKeep = getDaysToKeep();

    const activeDays = await activityRepo.getLastActiveDays(daysToKeep);
    cachedActiveDays = activeDays;
    lastCacheUpdate = new Date();

    console.log(
      `[ArchiveHelper] Cache refreshed with ${activeDays.length} active days:`,
      activeDays
    );
  } catch (error) {
    console.error('[ArchiveHelper] Failed to refresh cache:', error);
    // Keep old cache on error
  }
}

/**
 * Check if a date should be queried from archive tables
 * Returns true if date is older than the last N active days
 *
 * @param date - Date string in YYYY-MM-DD format
 * @returns true if should query archive, false if should query main table
 */
export function isArchiveDate(date: string): boolean {
  // If cache is empty, assume main table (safer default)
  if (cachedActiveDays.length === 0) {
    return false;
  }

  // If date is in the cached active days, it's in main table
  if (cachedActiveDays.includes(date)) {
    return false;
  }

  // Get the oldest active day (cutoff date)
  const cutoffDate = cachedActiveDays[cachedActiveDays.length - 1];

  // If date is older than cutoff, it's archived
  return date < cutoffDate;
}

/**
 * Get the appropriate table name based on date
 *
 * @param date - Date string in YYYY-MM-DD format
 * @param baseTable - Base table name ('bets' or 'tickets')
 * @returns Full table name ('bets', 'bets_archive', 'tickets', 'tickets_archive')
 */
export function getTableName(date: string, baseTable: 'bets' | 'tickets'): string {
  const isArchived = isArchiveDate(date);
  return isArchived ? `${baseTable}_archive` : baseTable;
}

/**
 * Get the appropriate RPC function name based on date
 * Archive RPCs have '_archive' suffix
 *
 * @param date - Date string in YYYY-MM-DD format
 * @param baseRpcName - Base RPC function name (e.g., 'ticket_full_json_plpgsql')
 * @returns Full RPC name with '_archive' suffix if needed
 */
export function getRpcName(date: string, baseRpcName: string): string {
  const isArchived = isArchiveDate(date);
  return isArchived ? `${baseRpcName}_archive` : baseRpcName;
}

/**
 * Get cache status for debugging/monitoring
 */
export function getCacheStatus(): {
  cachedDays: string[];
  lastUpdate: Date | null;
  daysToKeep: number;
} {
  return {
    cachedDays: [...cachedActiveDays],
    lastUpdate: lastCacheUpdate,
    daysToKeep: getDaysToKeep(),
  };
}
