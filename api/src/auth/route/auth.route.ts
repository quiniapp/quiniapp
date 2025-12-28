import { Request, Response, Router } from 'express';
import { AuthController } from '../controller/auth.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { IUserEntityFront } from '@helper/types/user.type';
import { supabase } from 'api/database/db.connection';
import { generateEmail } from 'api/helper/generateEmail';
import { signUserToken } from 'api/helper/JWT';
import { asyncHandler } from '../../middlewares/error.middleware';
import { UnauthorizedError } from '@helper/errors';
import { loginSchema } from '@helper/schemas/auth.schema';
import { SESSION_CONFIG } from 'api/src/config/session.config';

// Use secure cookies only in production (HTTPS)
const IS_PRODUCTION = process.env.IS_LOCAL !== 'true';

// Cookie configuration based on SESSION_CONFIG
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: SESSION_CONFIG.COOKIE_SECURE,
  sameSite: SESSION_CONFIG.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none',
  path: '/',
  domain: SESSION_CONFIG.COOKIE_DOMAIN,
};

export class AuthRouter {
  public publicRouter: Router;
  public privateRouter: Router;
  private controller: AuthController;

  constructor() {
    this.publicRouter = Router();
    this.privateRouter = Router();
    this.controller = new AuthController();
    this.setupPublicRoutes();
    this.setupPrivateRoutes();
  }

  private setupPublicRoutes() {
    this.publicRouter.post('/login', this.loginHandler);
    this.publicRouter.post('/refresh', this.refreshTokenHandler); // NEW - Phase 2
  }

  private setupPrivateRoutes() {
    this.privateRouter.post('/logout', this.logoutHandler);
    this.privateRouter.post('/logout-all', this.logoutAllHandler); // NEW - Phase 2
    this.privateRouter.get('/validate', this.validateHandler);
  }

  /**
   * POST /api/auth/login
   * Maintains backward compatibility but keeps legacy Supabase auth for now
   * Phase 4 will switch to using loginWithSession exclusively
   */
  private loginHandler = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;

    // Validación automática - Zod lanza error si falla
    const validated = loginSchema.parse({ username, password });

    // Autenticación con Supabase (LEGACY - will be removed in Phase 4)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: generateEmail(validated.username),
      password: validated.password,
    });

    if (error) {
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    // Cookies de sesión (sin maxAge) - se borran al cerrar el navegador
    // El timeout de 3 horas se maneja en el frontend (AuthProvider)
    res.cookie('access_token', data.session.access_token, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      path: '/',
    });

    // Obtener datos del usuario
    const loginResponse = await this.controller.login({
      username: validated.username,
      password: validated.password,
    });

    res.cookie('user_token', signUserToken(loginResponse.user, loginResponse.organization_id), {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      path: '/',
    });

    // Respuesta exitosa
    const response: APIResponse<IUserEntityFront> = {
      data: {
        user: loginResponse.user,
      },
    };

    res.status(200).json(response);
  });

  /**
   * POST /api/auth/refresh (NEW - Phase 2)
   * Refresh access token using refresh token
   */
  private refreshTokenHandler = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies[SESSION_CONFIG.REFRESH_TOKEN_COOKIE_NAME];

    if (!refreshToken) {
      throw new UnauthorizedError('No refresh token provided');
    }

    const ipAddress = (req.ip || req.socket.remoteAddress) as string;
    const userAgent = req.headers['user-agent'];

    const refreshResponse = await this.controller.refreshToken(refreshToken, ipAddress, userAgent);

    // Set new cookies
    res.cookie(SESSION_CONFIG.ACCESS_TOKEN_COOKIE_NAME, refreshResponse.access_token, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie(SESSION_CONFIG.REFRESH_TOKEN_COOKIE_NAME, refreshResponse.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    const response: APIResponse<{ success: boolean }> = {
      data: {
        success: true,
      },
    };

    res.status(200).json(response);
  });

  /**
   * POST /api/private/auth/logout
   * Maintains backward compatibility
   */
  private logoutHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user, token } = req.user!;

    if (!token) {
      throw new UnauthorizedError('Token no encontrado');
    }

    const result = await this.controller.logout({ token: token, user_id: user.user_id! });

    res.clearCookie('access_token', {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      path: '/',
    });
    res.clearCookie('user_token', {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      path: '/',
    });

    // Also clear new session cookies if they exist (Phase 2+)
    res.clearCookie(SESSION_CONFIG.ACCESS_TOKEN_COOKIE_NAME, COOKIE_OPTIONS);
    res.clearCookie(SESSION_CONFIG.REFRESH_TOKEN_COOKIE_NAME, COOKIE_OPTIONS);

    const response: APIResponse<boolean> = {
      data: {
        data: result,
      },
    };

    res.status(200).json(response);
  });

  /**
   * POST /api/private/auth/logout-all (NEW - Phase 2)
   * Logout from all devices (revoke all user sessions)
   */
  private logoutAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req.user!;

    if (!user) {
      throw new UnauthorizedError('No active session');
    }

    // For now, this will only work with new session system
    // In Phase 4, we'll fully migrate to new system
    // await this.controller.logoutSession(sessionId, user.user_id!, true);

    // Clear cookies
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      path: '/',
    });
    res.clearCookie('user_token', {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      path: '/',
    });
    res.clearCookie(SESSION_CONFIG.ACCESS_TOKEN_COOKIE_NAME, COOKIE_OPTIONS);
    res.clearCookie(SESSION_CONFIG.REFRESH_TOKEN_COOKIE_NAME, COOKIE_OPTIONS);

    const response: APIResponse<boolean> = {
      data: {
        success: true,
      },
    };

    res.status(200).json(response);
  });

  /**
   * GET /api/private/auth/validate
   * Validate current session
   */
  private validateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req.user!;

    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    const response: APIResponse<IUserEntityFront> = {
      data: {
        user,
      },
    };

    res.status(200).json(response);
  });
}
