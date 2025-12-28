/**
 * Session Configuration
 * Centralized session management settings for QuiniApp authentication
 *
 * IMPORTANT: Keep in sync with helper/config/session.config.ts for frontend
 */

// Helper to parse time strings (15m, 2h, 7d, etc.)
function parseTime(timeStr: string): number {
  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid time format: ${timeStr}`);

  const [, value, unit] = match;
  return parseInt(value) * units[unit];
}

export const SESSION_CONFIG = {
  // JWT Token Durations
  JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_TOKEN_EXPIRATION || '15m', // 15 minutes
  JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_TOKEN_EXPIRATION || '30d', // 30 days

  // Session Timeouts (in milliseconds)
  // UPDATED: 4 hours inactivity (not 30 minutes from sessions.md)
  INACTIVITY_TIMEOUT: parseTime(process.env.SESSION_INACTIVITY_TIMEOUT || '4h'), // 4 hours

  // Sliding window extension per activity
  SLIDING_WINDOW: parseTime(process.env.SESSION_SLIDING_WINDOW || '15m'), // 15 minutes

  // Absolute session timeout (very long or disabled)
  // UPDATED: 30 days max session (not 8 hours from sessions.md)
  ABSOLUTE_TIMEOUT: parseTime(process.env.SESSION_ABSOLUTE_TIMEOUT || '30d'), // 30 days

  // Cleanup interval for expired sessions
  CLEANUP_INTERVAL: parseTime(process.env.SESSION_CLEANUP_INTERVAL || '1h'), // 1 hour

  // Security Settings
  MAX_FAILED_ATTEMPTS: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5'), // 5 attempts
  LOCKOUT_DURATION: parseTime(process.env.ACCOUNT_LOCKOUT_DURATION || '15m'), // 15 minutes
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12'), // 12 rounds
  MAX_CONCURRENT_SESSIONS: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '0'), // 0 = unlimited

  // Cookie Settings
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  COOKIE_SECURE: process.env.COOKIE_SECURE !== 'false', // default true
  COOKIE_SAME_SITE: (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'none',
  COOKIE_HTTP_ONLY: true, // Always true for security

  // Token Names
  ACCESS_TOKEN_COOKIE_NAME: 'access_token',
  REFRESH_TOKEN_COOKIE_NAME: 'refresh_token',
};

// Validation
if (SESSION_CONFIG.INACTIVITY_TIMEOUT > SESSION_CONFIG.ABSOLUTE_TIMEOUT) {
  console.warn('[SESSION_CONFIG] INACTIVITY_TIMEOUT is greater than ABSOLUTE_TIMEOUT');
}

export type SessionConfig = typeof SESSION_CONFIG;
