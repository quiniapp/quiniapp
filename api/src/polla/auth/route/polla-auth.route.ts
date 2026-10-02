import { Request, Response, Router } from 'express';
import { UnauthorizedError } from '@helper/errors';
import { pollaLoginSchema, pollaChangePasswordSchema } from '@helper/polla/schemas/auth.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaAuthController, IPollaLoginResult } from '../controller/polla-auth.controller';
import { POLLA_SESSION_CONFIG, pollaCookieOptions } from '../../config/polla-session.config';
import { getPollaSession } from '../../middleware/polla-auth.middleware';

const setAuthCookies = (res: Response, tokens: IPollaLoginResult) => {
  res.cookie(
    POLLA_SESSION_CONFIG.ACCESS_TOKEN_COOKIE_NAME,
    tokens.accessToken,
    pollaCookieOptions(POLLA_SESSION_CONFIG.ACCESS_TOKEN_MAX_AGE_MS)
  );
  res.cookie(
    POLLA_SESSION_CONFIG.REFRESH_TOKEN_COOKIE_NAME,
    tokens.refreshToken,
    pollaCookieOptions(POLLA_SESSION_CONFIG.REFRESH_TOKEN_MAX_AGE_MS)
  );
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie(POLLA_SESSION_CONFIG.ACCESS_TOKEN_COOKIE_NAME, { path: '/' });
  res.clearCookie(POLLA_SESSION_CONFIG.REFRESH_TOKEN_COOKIE_NAME, { path: '/' });
};

export class PollaAuthRouter {
  public publicRouter: Router;

  public privateRouter: Router;

  private controller = new PollaAuthController();

  constructor() {
    this.publicRouter = Router();
    this.privateRouter = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.publicRouter.post('/login', this.loginHandler);
    this.publicRouter.post('/refresh', this.refreshHandler);

    this.privateRouter.get('/validate', this.validateHandler);
    this.privateRouter.post('/logout', this.logoutHandler);
    this.privateRouter.post('/logout-all', this.logoutAllHandler);
    this.privateRouter.post('/change-password', this.changePasswordHandler);
  }

  private loginHandler = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = pollaLoginSchema.parse(req.body);

    const result = await this.controller.login(
      username,
      password,
      req.ip,
      req.headers['user-agent']
    );

    setAuthCookies(res, result);
    res.status(200).json({ data: { user: result.user } });
  });

  private refreshHandler = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies[POLLA_SESSION_CONFIG.REFRESH_TOKEN_COOKIE_NAME];

    if (!refreshToken) {
      throw new UnauthorizedError('No hay refresh token');
    }

    const result = await this.controller.refresh(refreshToken);

    setAuthCookies(res, result);
    res.status(200).json({ data: { user: result.user } });
  });

  private validateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    res.status(200).json({ data: { user } });
  });

  private logoutHandler = asyncHandler(async (req: Request, res: Response) => {
    const { session_id } = getPollaSession(req);
    await this.controller.logout(session_id);
    clearAuthCookies(res);
    res.status(200).json({ data: { success: true } });
  });

  private logoutAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.controller.logoutAll(user.polla_user_id);
    clearAuthCookies(res);
    res.status(200).json({ data: { success: true } });
  });

  private changePasswordHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const { current_password, new_password } = pollaChangePasswordSchema.parse(req.body);

    await this.controller.changePassword(user.polla_user_id, current_password, new_password);

    res.status(200).json({ data: { success: true } });
  });
}
