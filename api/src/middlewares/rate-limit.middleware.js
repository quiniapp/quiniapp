import rateLimit from 'express-rate-limit';
import { RATE_LIMIT_CONFIG } from '../config/rate-limit.config';
/**
 * Rate Limiter Factory
 * Creates rate limiter middleware instances with consistent error format
 */
const createRateLimiter = (config) => {
    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        // Custom handler for consistent error format (matches APIResponse)
        handler: (req, res) => {
            // Store error info for Morgan logging
            res.locals.errorInfo = {
                code: 'RATE_LIMIT_EXCEEDED',
                message: config.message,
                statusCode: 429,
            };
            res.status(429).json({
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: config.message,
                },
            });
        },
        // Use standard RateLimit-* headers (modern standard)
        standardHeaders: true, // RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
        legacyHeaders: false, // Disable X-RateLimit-* headers
        // Skip successful requests (optional - can be enabled to only count failed attempts)
        // skip: (req, res) => res.statusCode < 400,
    });
};
// Exported rate limiter instances
export const loginRateLimiter = createRateLimiter(RATE_LIMIT_CONFIG.LOGIN);
export const authRateLimiter = createRateLimiter(RATE_LIMIT_CONFIG.AUTH);
export const publicApiRateLimiter = createRateLimiter(RATE_LIMIT_CONFIG.PUBLIC);
export const privateApiRateLimiter = createRateLimiter(RATE_LIMIT_CONFIG.PRIVATE);
