/**
 * Rate Limiting Configuration
 * Defines rate limits for different endpoint types to prevent abuse
 */
export declare const RATE_LIMIT_CONFIG: {
  LOGIN: {
    windowMs: number;
    max: number;
    message: string;
  };
  AUTH: {
    windowMs: number;
    max: number;
    message: string;
  };
  PUBLIC: {
    windowMs: number;
    max: number;
    message: string;
  };
  PRIVATE: {
    windowMs: number;
    max: number;
    message: string;
  };
};
