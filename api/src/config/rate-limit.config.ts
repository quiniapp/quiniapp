const parseIntEnv = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

// Permissive hard caps — only trigger under extreme abuse, not normal usage.
// Primary DDoS mitigation is express-slow-down (adds delay); these are last-resort blocks.
export const RATE_LIMIT_CONFIG = {
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 min
    max: parseIntEnv('RATE_LIMIT_LOGIN_MAX', 100),
  },
  AUTH: {
    windowMs: 15 * 60 * 1000,
    max: parseIntEnv('RATE_LIMIT_AUTH_MAX', 500),
  },
  PUBLIC: {
    windowMs: 15 * 60 * 1000,
    max: parseIntEnv('RATE_LIMIT_PUBLIC_MAX', 2000),
  },
  PRIVATE: {
    windowMs: 15 * 60 * 1000,
    max: parseIntEnv('RATE_LIMIT_PRIVATE_MAX', 2000),
  },
};

export const SLOW_DOWN_CONFIG = {
  // Login: tight window — 5 req / 5 s → 5 s delay (bot detection)
  LOGIN: {
    windowMs: parseIntEnv('SLOW_DOWN_LOGIN_WINDOW_MS', 5 * 1000),
    delayAfter: parseIntEnv('SLOW_DOWN_LOGIN_DELAY_AFTER', 5),
    delayMs: parseIntEnv('SLOW_DOWN_LOGIN_DELAY_MS', 5000),
  },
  // Auth (refresh, validate, logout): 15 req / 10 s → 3 s delay
  AUTH: {
    windowMs: parseIntEnv('SLOW_DOWN_AUTH_WINDOW_MS', 10 * 1000),
    delayAfter: parseIntEnv('SLOW_DOWN_AUTH_DELAY_AFTER', 15),
    delayMs: parseIntEnv('SLOW_DOWN_AUTH_DELAY_MS', 3000),
  },
  // Public API: 40 req / 10 s → 2 s delay (scraper / flood protection)
  PUBLIC: {
    windowMs: parseIntEnv('SLOW_DOWN_PUBLIC_WINDOW_MS', 10 * 1000),
    delayAfter: parseIntEnv('SLOW_DOWN_PUBLIC_DELAY_AFTER', 40),
    delayMs: parseIntEnv('SLOW_DOWN_PUBLIC_DELAY_MS', 2000),
  },
  // Private API (authenticated): 80 req / 10 s → 2 s delay
  PRIVATE: {
    windowMs: parseIntEnv('SLOW_DOWN_PRIVATE_WINDOW_MS', 10 * 1000),
    delayAfter: parseIntEnv('SLOW_DOWN_PRIVATE_DELAY_AFTER', 80),
    delayMs: parseIntEnv('SLOW_DOWN_PRIVATE_DELAY_MS', 2000),
  },
};
