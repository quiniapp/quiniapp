import { Router } from 'express';
import { ArchiveAdminController } from '../controller/archive.controller';

const archiveAdminRouter = Router();
const archiveController = new ArchiveAdminController();

/**
 * GET /api/private/admin/archive/stats
 * Get archive statistics (main vs archive counts, compression ratios, etc.)
 */
archiveAdminRouter.get('/stats', (req, res) => archiveController.getStats(req, res));

/**
 * POST /api/private/admin/archive/run
 * Manually trigger archive job
 * Body: { days_to_keep?: number }
 */
archiveAdminRouter.post('/run', (req, res) => archiveController.runArchiveManual(req, res));

/**
 * GET /api/private/admin/archive/activity-days
 * Get all activity days
 */
archiveAdminRouter.get('/activity-days', (req, res) => archiveController.getActivityDays(req, res));

/**
 * POST /api/private/admin/archive/update-activity
 * Update activity counts for a specific date
 * Body: { date: string } (format: YYYY-MM-DD)
 */
archiveAdminRouter.post('/update-activity', (req, res) => {
  archiveController.updateActivityForDate(req, res);
});

/**
 * GET /api/private/admin/archive/cron-status
 * Get cron job status
 */
archiveAdminRouter.get('/cron-status', (req, res) => archiveController.getCronStatus(req, res));

export { archiveAdminRouter };
