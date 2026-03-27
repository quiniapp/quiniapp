export interface IArchiveResult {
  success: boolean;
  message: string;
  cutoff_date: string | null;
  archived_count: number;
  deleted_count: number;
  days_kept: number;
}
export interface IArchiveStats {
  main_tables: {
    bets_count: number;
    tickets_count: number;
  };
  archive_tables: {
    bets_count: number;
    tickets_count: number;
  };
  activity: {
    active_days_count: number;
    last_active_date: string | null;
  };
  compression_ratio: {
    bets: number;
    tickets: number;
  };
}
export declare class ArchiveService {
  private activityDaysRepo;
  constructor();
  /**
   * Archive old bets (older than N active days)
   * Uses stored procedure if available, fallback to TypeScript implementation
   */
  archiveOldBets(daysToKeep?: number): Promise<IArchiveResult>;
  /**
   * Archive old tickets (older than N active days)
   * Uses stored procedure if available, fallback to TypeScript implementation
   */
  archiveOldTickets(daysToKeep?: number): Promise<IArchiveResult>;
  /**
   * Archive both bets and tickets in a single operation
   */
  archiveOldData(daysToKeep?: number): Promise<{
    success: boolean;
    bets: IArchiveResult;
    tickets: IArchiveResult;
    execution_time_ms?: number;
  }>;
  /**
   * Get archive statistics
   */
  getArchiveStats(): Promise<IArchiveStats>;
  /**
   * Manual implementation of archiving bets (fallback)
   * This is database-agnostic and can be used if stored procedures fail
   */
  private archiveOldBetsManual;
  /**
   * Manual implementation of archiving tickets (fallback)
   */
  private archiveOldTicketsManual;
  /**
   * Manual implementation of archiving both bets and tickets
   */
  private archiveOldDataManual;
  /**
   * Manual implementation of getting archive stats
   */
  private getArchiveStatsManual;
}
