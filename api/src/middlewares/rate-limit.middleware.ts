import slowDown from 'express-slow-down';
import { SLOW_DOWN_CONFIG } from '../config/rate-limit.config';

const makeSlowDown = (cfg: { windowMs: number; delayAfter: number; delayMs: number }) =>
  slowDown({
    windowMs: cfg.windowMs,
    delayAfter: cfg.delayAfter,
    delayMs: () => cfg.delayMs,
    skipSuccessfulRequests: false,
  });

export const loginSlowDown = makeSlowDown(SLOW_DOWN_CONFIG.LOGIN);
export const authSlowDown = makeSlowDown(SLOW_DOWN_CONFIG.AUTH);
export const publicSlowDown = makeSlowDown(SLOW_DOWN_CONFIG.PUBLIC);
export const privateSlowDown = makeSlowDown(SLOW_DOWN_CONFIG.PRIVATE);
