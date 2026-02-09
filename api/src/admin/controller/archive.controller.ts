import { Request, Response } from 'express';
import { ArchiveService } from '../../archive/service/archive.service';
import { ActivityDaysRepository } from '../../activity/repository/activity-days.repository';
import { getCronService } from '../../cron/service/cron.service';

export class ArchiveAdminController {
  private archiveService: ArchiveService;
  private activityDaysRepo: ActivityDaysRepository;

  constructor() {
    this.archiveService = new ArchiveService();
    this.activityDaysRepo = new ActivityDaysRepository();
  }

  /**
   * GET /api/private/admin/archive/stats
   * Get archive statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const stats = await this.archiveService.getArchiveStats();
      const activeDays = await this.activityDaysRepo.getLastActiveDays(3);
      const cronService = getCronService();
      const cronStatus = cronService.getStatus();

      res.json({
        success: true,
        stats,
        active_days: activeDays,
        cron_status: cronStatus,
      });
    } catch (error) {
      console.error('[ArchiveAdminController] Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/private/admin/archive/run
   * Manually trigger archive job (for testing)
   */
  async runArchiveManual(req: Request, res: Response) {
    try {
      const { days_to_keep = 3 } = req.body;

      const result = await this.archiveService.archiveOldData(days_to_keep);

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error('[ArchiveAdminController] Error running archive:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/private/admin/archive/activity-days
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
      console.error('[ArchiveAdminController] Error getting activity days:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/private/admin/archive/update-activity
   * Update activity counts for a specific date
   */
  async updateActivityForDate(req: Request, res: Response) {
    try {
      const { date } = req.body;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: 'Date is required (format: YYYY-MM-DD)',
        });
      }

      await this.activityDaysRepo.updateActivityCounts(date);

      res.json({
        success: true,
        message: `Activity counts updated for ${date}`,
      });
    } catch (error) {
      console.error('[ArchiveAdminController] Error updating activity:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/private/admin/archive/cron-status
   * Get cron job status
   */
  async getCronStatus(req: Request, res: Response) {
    try {
      const cronService = getCronService();
      const status = cronService.getStatus();

      res.json({
        success: true,
        status,
      });
    } catch (error) {
      console.error('[ArchiveAdminController] Error getting cron status:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
