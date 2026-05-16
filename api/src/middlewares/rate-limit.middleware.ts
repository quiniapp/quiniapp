import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { RATE_LIMIT_CONFIG, SLOW_DOWN_CONFIG } from '../config/rate-limit.config';

const makeRateLimit = (cfg: { windowMs: number; max: number }) =>
  rateLimit({
    windowMs: cfg.windowMs,
    max: cfg.max,
    standardHeaders: true,
    legacyHeaders: false,
  });

const makeSlowDown = (cfg: { windowMs: number; delayAfter: number; delayMs: number }) =>
  slowDown({
    windowMs: cfg.windowMs,
    delayAfter: cfg.delayAfter,
    delayMs: () => cfg.delayMs,
    skipSuccessfulRequests: false,
  });

export const loginRateLimit = makeRateLimit(RATE_LIMIT_CONFIG.LOGIN);
export const authRateLimit = makeRateLimit(RATE_LIMIT_CONFIG.AUTH);
export const publicRateLimit = makeRateLimit(RATE_LIMIT_CONFIG.PUBLIC);
export const privateRateLimit = makeRateLimit(RATE_LIMIT_CONFIG.PRIVATE);

export const loginSlowDown = makeSlowDown(SLOW_DOWN_CONFIG.LOGIN);
export const authSlowDown = makeSlowDown(SLOW_DOWN_CONFIG.AUTH);
export const publicSlowDown = makeSlowDown(SLOW_DOWN_CONFIG.PUBLIC);
export const privateSlowDown = makeSlowDown(SLOW_DOWN_CONFIG.PRIVATE);
