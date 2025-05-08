import { Request, RequestHandler, Response, Router } from 'express';
import { UserController } from '../controller/user.controller';
import { INewUserEntity } from '@helper/request/user.response';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { newUserSchema } from '../helper/schemaValidators';

export class UserRouter {
  public router: Router;

  private controller: UserController;

  constructor() {
    this.router = Router();
    this.controller = new UserController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/:id', this.controller.get);
    this.router.get('/', this.controller.getAll);
    this.router.post('/', this.newUserhandler);
    this.router.put('/:id', this.controller.update);
    this.router.delete('/:id', this.controller.delete);
  }

  private newUserhandler: RequestHandler = async (req: Request, res: Response) => {
    try {
      const { newUser }: { newUser: INewUserEntity } = req.body;

      if (newUser.user_type === USER_TYPE.OWNER) {
        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.FORBIDDEN,
            message: ERROR_MESSAGE.FORBIDDEN,
          },
        };
        res.status(403).json(response);
        return;
      }

      const result = newUserSchema.safeParse(newUser);
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

      const user = await this.controller.create(newUser);
      if (!user) {
        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.AUTH_ERROR,
            message: ERROR_MESSAGE.AUTH_ERROR,
          },
        };
        res.status(500).json(response);
        return;
      }
      const response: APIResponse<IUserEntityFront> = {
        data: {
          user: user,
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

      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.INTERNAL_SERVER_ERROR,
          message: 'Unexpected error',
        },
      };
      res.status(500).json(response);
    }
  };
}
