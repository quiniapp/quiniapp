/**
 * Rate Limiting Configuration
 * Defines rate limits for different endpoint types to prevent abuse
 */

// Helper to parse integers from env vars
const parseIntEnv = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

export const RATE_LIMIT_CONFIG = {
  // Login endpoint (strictest - matches account lockout policy)
  LOGIN: {
    windowMs: parseIntEnv('RATE_LIMIT_LOGIN_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
    max: parseIntEnv('RATE_LIMIT_LOGIN_MAX', 5), // 5 attempts
    message:
      process.env.RATE_LIMIT_LOGIN_MESSAGE ||
      'Demasiados intentos de inicio de sesión. Intenta nuevamente en 15 minutos.',
  },

  // Other auth endpoints (refresh, validate, etc.)
  AUTH: {
    windowMs: parseIntEnv('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
    max: parseIntEnv('RATE_LIMIT_AUTH_MAX', 10), // 10 attempts
    message:
      process.env.RATE_LIMIT_AUTH_MESSAGE ||
      'Demasiadas solicitudes de autenticación. Intenta nuevamente en 15 minutos.',
  },

  // General public API endpoints
  PUBLIC: {
    windowMs: parseIntEnv('RATE_LIMIT_PUBLIC_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
    max: parseIntEnv('RATE_LIMIT_PUBLIC_MAX', 100), // 100 requests
    message:
      process.env.RATE_LIMIT_PUBLIC_MESSAGE ||
      'Demasiadas solicitudes. Intenta nuevamente en 15 minutos.',
  },

  // Private authenticated API endpoints
  PRIVATE: {
    windowMs: parseIntEnv('RATE_LIMIT_PRIVATE_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
    max: parseIntEnv('RATE_LIMIT_PRIVATE_MAX', 200), // 200 requests
    message:
      process.env.RATE_LIMIT_PRIVATE_MESSAGE ||
      'Demasiadas solicitudes. Intenta nuevamente en 15 minutos.',
  },
};
