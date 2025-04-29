import { Request, RequestHandler, Response, Router } from 'express';
import { AuthController } from '../controller/auth.controller';
import { z } from 'zod';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';

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

  // Definís el handler afuera:
  private loginHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.BAD_REQUEST,
            message: ERROR_MESSAGE.BAD_REQUEST,
          },
        };
        res.status(400).json(response); // <-- SIN return
        return;
      }

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

      const loginResponse = await this.controller.login({ username, password });
      res.status(200).json(loginResponse); // <-- SIN return
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

  private setupPrivateRoutes() {
    this.privateRouter.post('/logout', (req, res) => {
      return this.controller.logout(req, res);
    });
  }
}

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const logoutSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  token: z.string().min(1, 'Password is required'),
});
