import { Request, Response, NextFunction } from 'express';
import { IUserEntityFront } from '@helper/types/user.type';
import { UnauthorizedError } from '@helper/errors';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { verifyAccessToken } from 'api/helper/JWT';
import { SessionRepository } from 'api/src/session/repository/session.repository';
import { AuthRepository } from 'api/src/auth/repository/auth.repository';
import { parseUser } from 'api/src/user/helper/parseUser';
import { SESSION_CONFIG } from 'api/src/config/session.config';
import { sessionCache } from 'api/src/session/cache/session.cache';
import { activityCache } from 'api/src/session/cache/session-activity.cache';

// Extend Express Request interface to include session info
declare module 'express' {
  export interface Request {
    user?: {
      user: IUserEntityFront;
      session_id: string;
      organization_id: string;
    };
    organization_id?: string;
  }
}

const sessionRepository = new SessionRepository();
const authRepository = new AuthRepository();

// Endpoints that don't count as user activity (passive checks)
const PASSIVE_PATHS = ['/auth/validate', '/auth/stream'];

/**
 * Session-based authentication middleware.
 *
 * Uses two in-memory caches to eliminate per-request DB writes:
 * - SessionCache: avoids DB reads on cache hit
 * - ActivityCache: buffers activity updates, flushed to DB every 30 min by the monitor job
 *
 * Passive endpoints (/auth/validate, /auth/stream) do not update activity.
 */
export const isAuthenticated = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = req.cookies[SESSION_CONFIG.ACCESS_TOKEN_COOKIE_NAME];

    if (!accessToken) {
      throw new UnauthorizedError('No autenticado - token no encontrado');
    }

    // 1. Verify access token JWT
    let decoded: ReturnType<typeof verifyAccessToken>;
    try {
      decoded = verifyAccessToken(accessToken);
    } catch {
      throw new UnauthorizedError('Token de acceso inválido');
    }

    // 2. Check session cache (cache miss → DB read)
    let sessionEntry = sessionCache.get(decoded.session_id);

    if (!sessionEntry) {
      const session = await sessionRepository.getById(decoded.session_id);
      if (!session || !session.is_active) {
        throw new UnauthorizedError('Sesión inválida o expirada');
      }
      sessionEntry = {
        user_id: session.user_id,
        organization_id: session.organization_id,
        expires_at: session.expires_at,
        created_at: session.created_at,
      };
      sessionCache.set(decoded.session_id, sessionEntry);
    }

    // 3. Check expiry — activity cache may have a newer expires_at than the DB-sourced cache
    const activityEntry = activityCache.get(decoded.session_id);
    const effectiveExpiry = activityEntry ? activityEntry.expires_at : sessionEntry.expires_at;

    if (new Date() > effectiveExpiry) {
      await sessionRepository.revoke(decoded.session_id, 'expired');
      sessionCache.delete(decoded.session_id);
      activityCache.delete(decoded.session_id);
      throw new UnauthorizedError('Sesión expirada');
    }

    // 4. Update activity for real requests (not passive endpoints)
    const isPassive = PASSIVE_PATHS.some((p) => req.path.endsWith(p));
    if (!isPassive) {
      const newExpiry = activityCache.mark(decoded.session_id, sessionEntry.created_at);
      sessionCache.updateExpiry(decoded.session_id, newExpiry);
    }

    // 5. Get fresh user data from database
    const userData = await authRepository.getUserById(decoded.user_id);

    // 6. Attach user to request
    req.user = {
      user: parseUser(userData),
      session_id: decoded.session_id,
      organization_id: sessionEntry.organization_id,
    };
    req.organization_id = sessionEntry.organization_id;

    next();
  }
);

/**
 * Helper function to get session info from request
 */
export const getSessionInfo = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('No active session');
  }

  return {
    user_id: req.user.user.user_id!,
    session_id: req.user.session_id,
    organization_id: req.user.organization_id,
    user_type: req.user.user.user_type,
  };
};
