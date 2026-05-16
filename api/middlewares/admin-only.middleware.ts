import { Request, Response, NextFunction } from 'express';
import { USER_TYPE } from '@helper/types/user.type';
import { ForbiddenError } from '@helper/errors';
import { asyncHandler } from 'api/src/middlewares/error.middleware';

/**
 * Middleware to restrict access to non-cashier users only
 * Must be used after isAuthenticated middleware
 *
 * Allows: OWNER, CAPITALIST, SUPERADMIN, ADMIN
 * Blocks: CASHIER
 */
export const requireNonCashier = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.user) {
      throw new ForbiddenError('Usuario no autenticado');
    }

    if (req.user.user.user_type === USER_TYPE.CASHIER) {
      throw new ForbiddenError('No tiene permisos para acceder a este recurso');
    }

    next();
  }
);

/**
 * Middleware to restrict access to admin users only
 * Must be used after isAuthenticated middleware
 *
 * Allows: OWNER, CAPITALIST, SUPERADMIN, ADMIN
 * Blocks: CASHIER
 *
 * Alias for requireNonCashier - more semantic for admin endpoints
 */
export const requireAdmin = requireNonCashier;

/**
 * Middleware to restrict access to OWNER users only
 * Must be used after isAuthenticated middleware
 */
export const requireOwner = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.user) {
      throw new ForbiddenError('Usuario no autenticado');
    }

    if (req.user.user.user_type !== USER_TYPE.OWNER) {
      throw new ForbiddenError('Solo el propietario puede realizar esta acción');
    }

    next();
  }
);
