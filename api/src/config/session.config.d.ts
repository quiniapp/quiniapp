/**
 * Session Configuration
 * Centralized session management settings for QuiniApp authentication
 *
 * IMPORTANT: Keep in sync with helper/config/session.config.ts for frontend
 */
export declare const SESSION_CONFIG: {
  JWT_ACCESS_EXPIRATION: string;
  JWT_REFRESH_EXPIRATION: string;
  INACTIVITY_TIMEOUT: number;
  SLIDING_WINDOW: number;
  ABSOLUTE_TIMEOUT: number;
  CLEANUP_INTERVAL: number;
  MAX_FAILED_ATTEMPTS: number;
  LOCKOUT_DURATION: number;
  BCRYPT_ROUNDS: number;
  MAX_CONCURRENT_SESSIONS: number;
  COOKIE_DOMAIN: string | undefined;
  COOKIE_SECURE: boolean;
  COOKIE_SAME_SITE: 'strict' | 'lax' | 'none';
  COOKIE_HTTP_ONLY: boolean;
  ACCESS_TOKEN_COOKIE_NAME: string;
  REFRESH_TOKEN_COOKIE_NAME: string;
};
export type SessionConfig = typeof SESSION_CONFIG;
