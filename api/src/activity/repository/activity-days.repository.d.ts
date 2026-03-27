export interface IActivityDay {
  date: string;
  has_activity: boolean;
  bets_count: number;
  tickets_count: number;
  created_at: string;
  updated_at: string;
}
export declare class ActivityDaysRepository {
  /**
   * Mark a specific date as active
   */
  markDayAsActive(date: string): Promise<void>;
  /**
   * Update activity counts for a specific date
   * This counts actual bets and tickets for that date
   */
  updateActivityCounts(date: string): Promise<void>;
  /**
   * Get the last N active days (ordered by date DESC)
   */
  getLastActiveDays(limit?: number): Promise<string[]>;
  /**
   * Check if a date should be archived (older than last N active days)
   */
  shouldArchiveDate(date: string, daysToKeep?: number): Promise<boolean>;
  /**
   * Get all activity days (for debugging/admin purposes)
   */
  getAllActivityDays(): Promise<IActivityDay[]>;
  /**
   * Get activity days with activity only
   */
  getActiveDaysOnly(): Promise<IActivityDay[]>;
  /**
   * Get cutoff date (the date before which data should be archived)
   * Returns the Nth most recent active day
   */
  getCutoffDate(daysToKeep?: number): Promise<string | null>;
  /**
   * Manually create or update activity day record
   * This is a fallback for when stored procedures are not available
   */
  upsertActivityDay(
    date: string,
    hasActivity: boolean,
    betsCount: number,
    ticketsCount: number
  ): Promise<void>;
}
