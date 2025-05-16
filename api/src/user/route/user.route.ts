import { Request, RequestHandler, Response, Router } from 'express';
import { UserController } from '../controller/user.controller';
import { INewUserEntity } from '@helper/request/user.response';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { updateUserSchema, UserSchema } from '../helper/schemaValidators';

export class UserRouter {
  public router: Router;

  private controller: UserController;

  constructor() {
    this.router = Router();
    this.controller = new UserController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/:id', this.getUserHandler);
    this.router.get('/', this.getAllUserHandler);
    this.router.post('/', this.newUserhandler);
    this.router.put('/:id', this.updateUserHandler);
    this.router.delete('/:id', this.deleteUserHandler);
  }

  private newUserhandler: RequestHandler = async (req: Request, res: Response) => {
    const { newUser }: { newUser: INewUserEntity } = req.body;
    if (!newUser) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.NEW_USER_REQUIRED,
          message: ERROR_MESSAGE.NEW_USER_REQUIRED,
        },
      };
      res.status(403).json(response);
      return;
    }
    if (newUser?.user_type === USER_TYPE.OWNER) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
        },
      };
      res.status(403).json(response);
      return;
    }
    const result = UserSchema.safeParse(newUser);
    if (!result.success) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: String(result.error.message),
        },
      };
      res.status(400).json(response); // <-- SIN return

      return;
    }
    try {
      const user = await this.controller.create(newUser);

      const response: APIResponse<IUserEntityFront> = {
        data: {
          user: user!,
        },
      };

      res.status(200).json(response);
    } catch (error) {
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
    }
  };

  private getUserHandler: RequestHandler = async (req: Request, res: Response) => {
    const { id: user_id } = req.params;
    const { user } = req;
    if (!user_id) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.ID_REQUIRED,
          message: ERROR_MESSAGE.ID_REQUIRED,
        },
      };
      res.status(403).json(response);
      return;
    }

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
        },
      };
      res.status(403).json(response);
      return;
    }
    try {
      const user = await this.controller.get({ user_id });
      if (!user) {
        const response: APIResponse<undefined> = {
          error: {
            error: ERROR_TYPE.USER_NOT_FOUND,
            message: ERROR_MESSAGE.USER_NOT_FOUND,
          },
        };
        res.status(403).json(response);
        return;
      }
      const response: APIResponse<IUserEntityFront> = {
        data: {
          user,
        },
      };
      res.status(200).json(response);
      return;
    } catch (error) {
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
    }
  };
  private getAllUserHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
        },
      };
      res.status(403).json(response);
      return;
    }
    try {
      const users = await this.controller.getAll();
      const response: APIResponse<IUserEntityFront[]> = {
        data: {
          users,
        },
      };
      res.status(200).json(response);
      return;
    } catch (error) {
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
    }
  };
  private updateUserHandler: RequestHandler = async (req: Request, res: Response) => {
    const { id: user_id } = req.params;
    const { updateUser } = req.body;
    const { user } = req;
    if (!user_id || !updateUser) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: ERROR_MESSAGE.BAD_REQUEST,
        },
      };
      res.status(403).json(response);
      return;
    }
    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
        },
      };
      res.status(403).json(response);
      return;
    }

    const result = updateUserSchema.safeParse(updateUser);
    if (!result.success) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: String(result.error.message),
        },
      };
      res.status(400).json(response); // <-- SIN return

      return;
    }
    try {
      const user = await this.controller.update(user_id, { ...updateUser });

      const response: APIResponse<IUserEntityFront> = {
        data: {
          user,
        },
      };
      res.status(200).json(response);
      return;
    } catch (error) {
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
    }
  };
  private deleteUserHandler: RequestHandler = async (req: Request, res: Response) => {
    const { id: user_id } = req.params;
    const { user } = req;
    if (!user_id) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: ERROR_MESSAGE.BAD_REQUEST,
        },
      };
      res.status(403).json(response);
      return;
    }

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
        },
      };
      res.status(403).json(response);
      return;
    }
    try {
      const user = await this.controller.delete({ user_id });

      const response: APIResponse<IUserEntityFront> = {
        data: {
          user,
        },
      };
      res.status(200).json(response);
      return;
    } catch (error) {
      {
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
      }
    }
  };
}
