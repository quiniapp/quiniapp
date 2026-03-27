import { Request, Response } from 'express';
export declare class ArchiveController {
  private archiveService;
  private activityDaysRepo;
  constructor();
  /**
   * GET /api/private/archive/stats
   * Get archive statistics
   */
  getStats(req: Request, res: Response): Promise<void>;
  /**
   * POST /api/private/archive/trigger
   * Manually trigger archive job
   */
  triggerArchive(req: Request, res: Response): Promise<void>;
  /**
   * POST /api/private/archive/run
   * Alternative endpoint: Manually run archive and return detailed results
   */
  runArchive(req: Request, res: Response): Promise<void>;
  /**
   * GET /api/private/archive/activity-days
   * Get all activity days
   */
  getActivityDays(req: Request, res: Response): Promise<void>;
  /**
   * POST /api/private/archive/update-activity
   * Update activity counts for a specific date
   */
  updateActivityForDate(req: Request, res: Response): Promise<void>;
  /**
   * GET /api/private/archive/cron-status
   * Get cron job status
   */
  getCronStatus(req: Request, res: Response): Promise<void>;
}
