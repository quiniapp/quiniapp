/**
 * Cleanup expired sessions
 * Calls the database function to mark expired sessions as inactive
 */
export declare function cleanupExpiredSessions(): Promise<number>;
/**
 * Start the session cleanup job
 * Runs cleanup immediately, then every CLEANUP_INTERVAL_MS
 */
export declare function startSessionCleanupJob(): void;
/**
 * Stop the session cleanup job
 * Useful for graceful shutdown
 */
export declare function stopSessionCleanupJob(): void;
/**
 * Get job status
 */
export declare function isCleanupJobRunning(): boolean;
