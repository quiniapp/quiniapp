import cron from 'node-cron';
import { ArchiveService } from '../../archive/service/archive.service';
import { ActivityDaysRepository } from '../../activity/repository/activity-days.repository';
import { refreshActiveDaysCache } from '../../archive/helper/archive-helper';
export class CronService {
    constructor(daysToKeep = 2) {
        this.archiveTask = null;
        this.archiveService = new ArchiveService();
        this.activityDaysRepo = new ActivityDaysRepository();
        this.daysToKeep = daysToKeep;
    }
    /**
     * Initialize and start the archive cron job
     * Runs daily at 3:00 AM Argentina Time (UTC-3)
     * Cron expression: '0 3 * * *' (minute 0, hour 3, every day)
     */
    startArchiveCron() {
        if (this.archiveTask) {
            console.log('[CronService] Archive cron job already running');
            return;
        }
        // Schedule: Every day at 3:00 AM
        // '0 3 * * *' = minute 0, hour 3, every day of month, every month, every day of week
        this.archiveTask = cron.schedule('0 3 * * *', async () => {
            await this.runArchiveJob();
        }, {
            timezone: 'America/Argentina/Buenos_Aires', // UTC-3
        });
        console.log(`[CronService] Archive cron job started - runs daily at 3:00 AM (Argentina Time, UTC-3)`);
        console.log(`[CronService] Days to keep indexed: ${this.daysToKeep}`);
    }
    /**
     * Stop the archive cron job
     */
    stopArchiveCron() {
        if (this.archiveTask) {
            this.archiveTask.stop();
            this.archiveTask = null;
            console.log('[CronService] Archive cron job stopped');
        }
    }
    /**
     * Main archive job that runs daily
     */
    async runArchiveJob() {
        const startTime = Date.now();
        console.log('\n========================================');
        console.log('[CronService] Starting daily archive job');
        console.log(`[CronService] Timestamp: ${new Date().toISOString()}`);
        console.log('========================================\n');
        try {
            // Step 1: Update activity counts for yesterday (in case it wasn't done)
            const yesterday = this.getYesterday();
            console.log(`[CronService] Updating activity counts for ${yesterday}...`);
            await this.activityDaysRepo.updateActivityCounts(yesterday);
            // Step 2: Get cutoff date
            const cutoffDate = await this.activityDaysRepo.getCutoffDate(this.daysToKeep);
            console.log(`[CronService] Cutoff date: ${cutoffDate || 'Not enough active days yet'}`);
            if (!cutoffDate) {
                console.log('[CronService] Not enough active days to perform archiving. Skipping.');
                return;
            }
            // Step 3: Get stats before archiving
            console.log('[CronService] Getting stats before archiving...');
            const statsBefore = await this.archiveService.getArchiveStats();
            console.log('[CronService] Stats before:');
            console.log(`  - Main bets: ${statsBefore.main_tables.bets_count}`);
            console.log(`  - Main tickets: ${statsBefore.main_tables.tickets_count}`);
            console.log(`  - Archive bets: ${statsBefore.archive_tables.bets_count}`);
            console.log(`  - Archive tickets: ${statsBefore.archive_tables.tickets_count}`);
            // Step 4: Archive old data
            console.log('[CronService] Archiving old data...');
            const result = await this.archiveService.archiveOldData(this.daysToKeep);
            // Step 5: Refresh active days cache (critical for query routing)
            console.log('[CronService] Refreshing active days cache...');
            await refreshActiveDaysCache();
            // Step 6: Get stats after archiving
            const statsAfter = await this.archiveService.getArchiveStats();
            // Step 7: Log results
            const executionTime = Date.now() - startTime;
            console.log('\n========================================');
            console.log('[CronService] Archive job completed successfully');
            console.log('========================================');
            console.log('\nBETS:');
            console.log(`  - Archived: ${result.bets.archived_count}`);
            console.log(`  - Deleted from main: ${result.bets.deleted_count}`);
            console.log(`  - Cutoff date: ${result.bets.cutoff_date}`);
            console.log('\nTICKETS:');
            console.log(`  - Archived: ${result.tickets.archived_count}`);
            console.log(`  - Deleted from main: ${result.tickets.deleted_count}`);
            console.log(`  - Cutoff date: ${result.tickets.cutoff_date}`);
            console.log('\nSTATS AFTER:');
            console.log(`  - Main bets: ${statsAfter.main_tables.bets_count}`);
            console.log(`  - Main tickets: ${statsAfter.main_tables.tickets_count}`);
            console.log(`  - Archive bets: ${statsAfter.archive_tables.bets_count}`);
            console.log(`  - Archive tickets: ${statsAfter.archive_tables.tickets_count}`);
            console.log(`  - Compression ratio bets: ${statsAfter.compression_ratio.bets}%`);
            console.log(`  - Compression ratio tickets: ${statsAfter.compression_ratio.tickets}%`);
            console.log(`\n[CronService] Execution time: ${executionTime}ms`);
            console.log('========================================\n');
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            console.error('\n========================================');
            console.error('[CronService] ❌ Archive job FAILED');
            console.error('========================================');
            console.error('[CronService] Error:', error);
            console.error(`[CronService] Execution time: ${executionTime}ms`);
            console.error('========================================\n');
            // In production, you might want to send an alert/notification here
            // For example: send email, Slack message, or push to monitoring service
        }
    }
    /**
     * Manual trigger for testing purposes
     * Allows running the archive job on demand
     */
    async runArchiveJobManual() {
        console.log('[CronService] Manual archive job trigger');
        await this.runArchiveJob();
    }
    /**
     * Get yesterday's date in YYYY-MM-DD format
     */
    getYesterday() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }
    /**
     * Check if cron job is running
     */
    isRunning() {
        return this.archiveTask !== null;
    }
    /**
     * Get cron job status information
     */
    getStatus() {
        return {
            running: this.isRunning(),
            daysToKeep: this.daysToKeep,
            schedule: '0 3 * * * (Daily at 3:00 AM)',
            timezone: 'America/Argentina/Buenos_Aires (UTC-3)',
        };
    }
}
// Singleton instance
let cronServiceInstance = null;
/**
 * Get singleton instance of CronService
 */
export function getCronService(daysToKeep = 2) {
    if (!cronServiceInstance) {
        cronServiceInstance = new CronService(daysToKeep);
    }
    return cronServiceInstance;
}
