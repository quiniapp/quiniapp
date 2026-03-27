/**
 * Initialize the cache of active days
 * Should be called on server startup
 */
export declare function initializeActiveDaysCache(): Promise<void>;
/**
 * Refresh the cache of active days
 * Called by cron job after archiving operation completes
 */
export declare function refreshActiveDaysCache(): Promise<void>;
/**
 * Check if a date should be queried from archive tables
 * Returns true if date is older than the last N active days
 *
 * @param date - Date string in YYYY-MM-DD format
 * @returns true if should query archive, false if should query main table
 */
export declare function isArchiveDate(date: string): boolean;
/**
 * Get the appropriate table name based on date
 *
 * @param date - Date string in YYYY-MM-DD format
 * @param baseTable - Base table name ('bets' or 'tickets')
 * @returns Full table name ('bets', 'bets_archive', 'tickets', 'tickets_archive')
 */
export declare function getTableName(date: string, baseTable: 'bets' | 'tickets'): string;
/**
 * Get the appropriate RPC function name based on date
 * Archive RPCs have '_archive' suffix
 *
 * @param date - Date string in YYYY-MM-DD format
 * @param baseRpcName - Base RPC function name (e.g., 'ticket_full_json_plpgsql')
 * @returns Full RPC name with '_archive' suffix if needed
 */
export declare function getRpcName(date: string, baseRpcName: string): string;
/**
 * Get cache status for debugging/monitoring
 */
export declare function getCacheStatus(): {
  cachedDays: string[];
  lastUpdate: Date | null;
  daysToKeep: number;
};
