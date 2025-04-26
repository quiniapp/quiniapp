import { Router } from 'express';
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
    this.publicRouter.post('/login', (req, res) => {
      try {
        const { username, password } = req.body;

        if (!username || !password) {
          const response: APIResponse<null> = {
            error: {
              error: ERROR_TYPE.BAD_REQUEST,
              message: ERROR_MESSAGE.BAD_REQUEST,
            },
          };
          res.status(400).json(response);
        }
        const result = loginSchema.safeParse({ username, password });
        if (!result.success) {
          const response: APIResponse<null> = {
            error: {
              error: ERROR_TYPE.BAD_REQUEST,
              message: String(result.error.errors),
            },
          };
          res.status(400).json(response);
        }

        const loginResponse = this.controller.login({ username, password });

        res.json(loginResponse);
      } catch (error) {
        res
          .status(500)
          .json({ error: { error: error, message: ERROR_MESSAGE.INTERNAL_SERVER_ERROR } });
      }
    });
  }

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
