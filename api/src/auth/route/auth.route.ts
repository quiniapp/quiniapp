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

// Use secure cookies only in production (HTTPS)
const IS_PRODUCTION = process.env.IS_LOCAL !== 'true';

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
  }

  private setupPrivateRoutes() {
    this.privateRouter.post('/logout', this.logoutHandler);
    this.privateRouter.get('/validate', this.refreshHandler);
  }

  private loginHandler = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;

    // Validación automática - Zod lanza error si falla
    const validated = loginSchema.parse({ username, password });

    // Autenticación con Supabase
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

    const response: APIResponse<boolean> = {
      data: {
        data: result,
      },
    };

    res.status(200).json(response);
  });

  private refreshHandler = asyncHandler(async (req: Request, res: Response) => {
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
