import { Request, Response, NextFunction } from 'express';
/**
 * Middleware to restrict access to non-cashier users only
 * Must be used after isAuthenticated middleware
 *
 * Allows: OWNER, CAPITALIST, SUPERADMIN, ADMIN
 * Blocks: CASHIER
 */
export declare const requireNonCashier: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware to restrict access to admin users only
 * Must be used after isAuthenticated middleware
 *
 * Allows: OWNER, CAPITALIST, SUPERADMIN, ADMIN
 * Blocks: CASHIER
 *
 * Alias for requireNonCashier - more semantic for admin endpoints
 */
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
