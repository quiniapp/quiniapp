import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '@helper/errors';
import { POLLA_USER_TYPE, IPollaSessionUser } from '@helper/polla/types/user.type';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { verifyPollaAccessToken } from '../helper/polla-jwt';
import { PollaAuthRepository } from '../auth/repository/polla-auth.repository';
import { POLLA_SESSION_CONFIG } from '../config/polla-session.config';

declare module 'express' {
  export interface Request {
    pollaUser?: {
      user: IPollaSessionUser;
      session_id: string;
      polla_organization_id: string;
    };
  }
}

const authRepository = new PollaAuthRepository();

/** Endpoints que no cuentan como actividad del usuario. */
const PASSIVE_PATHS = ['/auth/validate'];

export const isPollaAuthenticated = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const accessToken = req.cookies[POLLA_SESSION_CONFIG.ACCESS_TOKEN_COOKIE_NAME];

    if (!accessToken) {
      throw new UnauthorizedError('No autenticado - token no encontrado');
    }

    let decoded: ReturnType<typeof verifyPollaAccessToken>;
    try {
      decoded = verifyPollaAccessToken(accessToken);
    } catch {
      throw new UnauthorizedError('Token de acceso inválido');
    }

    const session = await authRepository.getSessionById(decoded.session_id);
    if (!session || !session.is_active) {
      throw new UnauthorizedError('Sesión inválida o expirada');
    }

    if (new Date() > new Date(session.expires_at)) {
      await authRepository.revokeSession(decoded.session_id);
      throw new UnauthorizedError('Sesión expirada');
    }

    // Ventana deslizante: se persiste como mucho una vez por minuto.
    const isPassive = PASSIVE_PATHS.some((p) => req.path.endsWith(p));
    if (!isPassive) {
      const lastActivity = new Date(session.last_activity_at).getTime();
      if (Date.now() - lastActivity > POLLA_SESSION_CONFIG.ACTIVITY_WRITE_THROTTLE_MS) {
        await authRepository.touchSession(decoded.session_id);
      }
    }

    // Usuario fresco: un cambio de rol o una baja se aplican en el acto.
    const user = await authRepository.getSessionUserById(decoded.polla_user_id);
    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    req.pollaUser = {
      user,
      session_id: decoded.session_id,
      polla_organization_id: session.polla_organization_id,
    };

    next();
  }
);

export const getPollaSession = (req: Request) => {
  if (!req.pollaUser) {
    throw new UnauthorizedError('No hay sesión activa');
  }
  return req.pollaUser;
};

/** Middleware genérico de rol (QuiniApp hace estos chequeos inline en cada router). */
export const requirePollaRole =
  (...allowed: POLLA_USER_TYPE[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const { user } = getPollaSession(req);
    if (!allowed.includes(user.user_type)) {
      throw new ForbiddenError('No tenés permisos para esta acción');
    }
    next();
  };
