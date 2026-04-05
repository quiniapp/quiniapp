import { Router } from 'express';
import { ArchiveController } from '../controller/archive.controller';
import { requireAdmin } from '../../../middlewares/admin-only.middleware';

const router = Router();
const archiveController = new ArchiveController();

// Apply admin-only middleware to all routes in this router
// Blocks CASHIER users from accessing archive management endpoints
router.use(requireAdmin);

/**
 * GET /api/private/archive/stats
 * Get comprehensive archive statistics including:
 * - Main vs archive table counts
 * - Active days information
 * - Cron job status
 * - Compression ratios
 */
router.get('/stats', (req, res) => archiveController.getStats(req, res));

/**
 * POST /api/private/archive/trigger
 * Manual trigger for archive job (admin only)
 * Body: { days_to_keep?: number } (optional, defaults to env ARCHIVE_DAYS_TO_KEEP)
 *
 * Uses cron service to run the job (same as scheduled cron)
 */
router.post('/trigger', (req, res) => archiveController.triggerArchive(req, res));

/**
 * POST /api/private/archive/run
 * Alternative endpoint: Run archive and get detailed results
 * Body: { days_to_keep?: number } (optional, defaults to env ARCHIVE_DAYS_TO_KEEP)
 *
 * Returns detailed results including counts and execution time
 */
router.post('/run', (req, res) => archiveController.runArchive(req, res));

/**
 * GET /api/private/archive/activity-days
 * Get all activity days with detailed information
 * Returns both all days and active-only days
 */
router.get('/activity-days', (req, res) => archiveController.getActivityDays(req, res));

/**
 * POST /api/private/archive/update-activity
 * Update activity counts for a specific date
 * Body: { date: string } (format: YYYY-MM-DD)
 *
 * Recalculates bet and ticket counts for the given date
 */
router.post('/update-activity', (req, res) => archiveController.updateActivityForDate(req, res));

/**
 * GET /api/private/archive/cron-status
 * Get cron job status (running, last run, next run, etc.)
 */
router.get('/cron-status', (req, res) => archiveController.getCronStatus(req, res));

export default router;
