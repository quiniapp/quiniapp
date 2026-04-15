import { Request, Response } from 'express';
import { ArchiveService } from '../service/archive.service';
import { ActivityDaysRepository } from '../../activity/repository/activity-days.repository';
import { getCronService } from '../../cron/service/cron.service';
import { ARCHIVE_DAYS_TO_KEEP } from '../../../envs';

export class ArchiveController {
  private archiveService: ArchiveService;
  private activityDaysRepo: ActivityDaysRepository;

  constructor() {
    this.archiveService = new ArchiveService();
    this.activityDaysRepo = new ActivityDaysRepository();
  }

  /**
   * GET /api/private/archive/stats
   * Get archive statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const stats = await this.archiveService.getArchiveStats();
      const activeDays = await this.activityDaysRepo.getLastActiveDays(2);
      const cronService = getCronService(ARCHIVE_DAYS_TO_KEEP);
      const cronStatus = cronService.getStatus();

      res.json({
        success: true,
        stats,
        active_days: activeDays,
        cron_status: cronStatus,
      });
    } catch (error) {
      console.error('[ArchiveController] Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/private/archive/trigger
   * Manually trigger archive job
   */
  async triggerArchive(req: Request, res: Response) {
    try {
      const { days_to_keep = ARCHIVE_DAYS_TO_KEEP } = req.body;

      console.log('[ArchiveController] Manual archive trigger requested');

      const cronService = getCronService(days_to_keep);

      // Run the archive job through cron service (matches old implementation)
      await cronService.runArchiveJobManual();

      res.json({
        success: true,
        message: 'Archive job completed. Check server logs for details.',
      });
    } catch (error) {
      console.error('[ArchiveController] Error triggering archive:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/private/archive/run
   * Alternative endpoint: Manually run archive and return detailed results
   */
  async runArchive(req: Request, res: Response) {
    try {
      const { days_to_keep = ARCHIVE_DAYS_TO_KEEP } = req.body;

      const result = await this.archiveService.archiveOldData(days_to_keep);

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error('[ArchiveController] Error running archive:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/private/archive/activity-days
   * Get all activity days
   */
  async getActivityDays(req: Request, res: Response) {
    try {
      const allDays = await this.activityDaysRepo.getAllActivityDays();
      const activeDaysOnly = await this.activityDaysRepo.getActiveDaysOnly();

      res.json({
        success: true,
        all_days: allDays,
        active_days_only: activeDaysOnly,
        total_days: allDays.length,
        active_days_count: activeDaysOnly.length,
      });
    } catch (error) {
      console.error('[ArchiveController] Error getting activity days:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/private/archive/update-activity
   * Update activity counts for a specific date
   */
  async updateActivityForDate(req: Request, res: Response): Promise<void> {
    try {
      const { date } = req.body;

      if (!date) {
        res.status(400).json({
          success: false,
          error: 'Date is required (format: YYYY-MM-DD)',
        });
        return;
      }

      await this.activityDaysRepo.updateActivityCounts(date);

      res.json({
        success: true,
        message: `Activity counts updated for ${date}`,
      });
    } catch (error) {
      console.error('[ArchiveController] Error updating activity:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/private/archive/cron-status
   * Get cron job status
   */
  async getCronStatus(req: Request, res: Response) {
    try {
      const cronService = getCronService(ARCHIVE_DAYS_TO_KEEP);
      const status = cronService.getStatus();

      res.json({
        success: true,
        status,
      });
    } catch (error) {
      console.error('[ArchiveController] Error getting cron status:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
