import { Request, Response, Router } from 'express';
import { AuthController } from '../controller/auth.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { IUserEntityFront } from '@helper/types/user.type';
import { asyncHandler } from '../../middlewares/error.middleware';
import { UnauthorizedError } from '@helper/errors';
import { loginSchema } from '@helper/schemas/auth.schema';
import { SESSION_CONFIG } from 'api/src/config/session.config';

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
   * Login with username and password using custom JWT session system
   */
  private loginHandler = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;

    // Validación automática - Zod lanza error si falla
    const validated = loginSchema.parse({ username, password });

    const ipAddress = (req.ip || req.socket.remoteAddress) as string;
    const userAgent = req.headers['user-agent'];

    // Login with session system
    const loginResponse = await this.controller.loginWithSession(
      {
        username: validated.username,
        password: validated.password,
      },
      ipAddress,
      userAgent
    );

    // Set access token cookie (15 minutes)
    res.cookie(SESSION_CONFIG.ACCESS_TOKEN_COOKIE_NAME, loginResponse.access_token, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Set refresh token cookie (30 days)
    res.cookie(SESSION_CONFIG.REFRESH_TOKEN_COOKIE_NAME, loginResponse.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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

    const response: APIResponse<boolean> = {
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
    const { user, session_id } = req.user!;

    await this.controller.logoutSession(session_id, user.user_id!, false);

    // Also clear new session cookies if they exist (Phase 2+)
    res.clearCookie(SESSION_CONFIG.ACCESS_TOKEN_COOKIE_NAME, COOKIE_OPTIONS);
    res.clearCookie(SESSION_CONFIG.REFRESH_TOKEN_COOKIE_NAME, COOKIE_OPTIONS);

    const response: APIResponse<boolean> = {
      data: { data: true },
    };

    res.status(200).json(response);
  });

  /**
   * POST /api/private/auth/logout-all (NEW - Phase 2)
   * Logout from all devices (revoke all user sessions)
   */

  private logoutAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user, session_id } = req.user!;

    await this.controller.logoutSession(session_id, user.user_id!, true); // logoutAll = true

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
