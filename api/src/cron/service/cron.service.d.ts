export declare class CronService {
  private archiveService;
  private activityDaysRepo;
  private archiveTask;
  private daysToKeep;
  constructor(daysToKeep?: number);
  /**
   * Initialize and start the archive cron job
   * Runs daily at 3:00 AM Argentina Time (UTC-3)
   * Cron expression: '0 3 * * *' (minute 0, hour 3, every day)
   */
  startArchiveCron(): void;
  /**
   * Stop the archive cron job
   */
  stopArchiveCron(): void;
  /**
   * Main archive job that runs daily
   */
  private runArchiveJob;
  /**
   * Manual trigger for testing purposes
   * Allows running the archive job on demand
   */
  runArchiveJobManual(): Promise<void>;
  /**
   * Get yesterday's date in YYYY-MM-DD format
   */
  private getYesterday;
  /**
   * Check if cron job is running
   */
  isRunning(): boolean;
  /**
   * Get cron job status information
   */
  getStatus(): {
    running: boolean;
    daysToKeep: number;
    schedule: string;
    timezone: string;
  };
}
/**
 * Get singleton instance of CronService
 */
export declare function getCronService(daysToKeep?: number): CronService;
