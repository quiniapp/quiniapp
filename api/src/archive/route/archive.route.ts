import { Router } from 'express';
import { getCronService } from '../../cron/service/cron.service';
import { ARCHIVE_DAYS_TO_KEEP } from '../../../envs';

const router = Router();

/**
 * Manual trigger for archive job (admin only)
 * POST /api/private/archive/trigger
 *
 * IMPORTANT: This should be protected with admin authentication
 * Remove or disable this endpoint in production after testing
 */
router.post('/trigger', async (req, res) => {
  try {
    console.log('[Archive Route] Manual archive trigger requested');

    const cronService = getCronService(ARCHIVE_DAYS_TO_KEEP);

    // Run the archive job
    await cronService.runArchiveJobManual();

    res.json({
      success: true,
      message: 'Archive job completed. Check server logs for details.',
    });
  } catch (error) {
    console.error('[Archive Route] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get archive statistics
 * GET /api/private/archive/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { ArchiveService } = await import('../../archive/service/archive.service');
    const archiveService = new ArchiveService();

    const stats = await archiveService.getArchiveStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[Archive Route] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get cron service status
 * GET /api/private/archive/cron-status
 */
router.get('/cron-status', (req, res) => {
  const cronService = getCronService(ARCHIVE_DAYS_TO_KEEP);
  const status = cronService.getStatus();

  res.json({
    success: true,
    status,
  });
});

export default router;
