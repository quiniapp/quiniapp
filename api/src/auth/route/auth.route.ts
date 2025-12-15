import { Request, RequestHandler, Response, Router } from 'express';
import { AuthController } from '../controller/auth.controller';
import { z } from 'zod';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { IUserEntityFront } from '@helper/types/user.type';
import { supabase } from 'api/database/db.connection';
import { generateEmail } from 'api/helper/generateEmail';
import { signUserToken } from 'api/helper/JWT';

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

  // Definís el handler afuera:
  private loginHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      const result = loginSchema.safeParse({ username, password });
      if (!result.success) {
        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.BAD_REQUEST,
            message: String(result.error.message),
          },
        };
        res.status(400).json(response); // <-- SIN return

        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: generateEmail(username),
        password: password,
      });

      if (error) {
        console.error(error);
        throw new Error(ERROR_MESSAGE.INVALID_CREDENTIALS);
      }
      // Cookies de sesión (sin maxAge) - se borran al cerrar el navegador
      // El timeout de 3 horas se maneja en el frontend (AuthProvider)
      res.cookie('access_token', data.session.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      });
      const loginResponse = await this.controller.login({ username, password });
      const response: APIResponse<IUserEntityFront> = {
        data: {
          user: loginResponse.user,
        },
      };
      res.cookie('user_token', signUserToken(loginResponse.user, loginResponse.organization_id), {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      });
      res.status(200).json(response); // <-- SIN return
    } catch (error) {
      console.error('Login route error', error);

      if (error instanceof Error) {
        let statusCode = 500;
        if (
          error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
          error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
        ) {
          statusCode = 401;
        }

        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.AUTH_ERROR,
            message: error.message,
          },
        };
        res.status(statusCode).json(response);
        return;
      }

      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.INTERNAL_SERVER_ERROR,
          message: 'Unexpected error',
        },
      };
      res.status(500).json(response);
    }
  };

  private logoutHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user, token } = req.user!;

    if (!token) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.TOKEN_ERROR,
          message: 'Unexpected error',
        },
      };
      res.status(500).json(response);
    }
    try {
      const result = await this.controller.logout({ token: token, user_id: user.user_id! });
      const response: APIResponse<boolean> = {
        data: {
          data: result,
        },
      };

      res.clearCookie('access_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      });
      res.clearCookie('user_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      });

      res.status(200).json(response);
    } catch (error) {
      console.error('Login route error', error);

      if (error instanceof Error) {
        let statusCode = 500;
        if (
          error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
          error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
        ) {
          statusCode = 401;
        }

        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.AUTH_ERROR,
            message: error.message,
          },
        };
        res.status(statusCode).json(response);
        return;
      }

      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.INTERNAL_SERVER_ERROR,
          message: 'Unexpected error',
        },
      };
      res.status(500).json(response);
    }
  };

  private refreshHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req.user!;
    if (!user) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.TOKEN_ERROR,
          message: 'Unexpected error',
        },
      };
      res.status(401).json(response);
    }
    try {
      const response: APIResponse<IUserEntityFront> = {
        data: {
          user,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error in /refresh route', error);
      res.status(500).json({
        error: {
          error: ERROR_TYPE.INTERNAL_SERVER_ERROR,
          message: 'Unexpected error',
        },
      });
    }
  };
}

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
