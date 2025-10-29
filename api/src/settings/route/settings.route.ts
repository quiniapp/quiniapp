import { Request, RequestHandler, Response, Router } from 'express';
import { SettingsController } from '../controller/settings.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';

export class SettingsLotteryRouter {
  public router: Router;
  private controller: SettingsController;
  constructor() {
    this.router = Router();
    this.controller = new SettingsController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/storage', this.getStorageSettingsHandler);
  }

  private getStorageSettingsHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user?.user) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: ERROR_MESSAGE.BAD_REQUEST,
        },
      };
      res.status(500).json(response);
      return;
    }
    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
        },
      };
      res.status(500).json(response);
      return;
    }
    try {
      const settings = await this.controller.getStorageStatus();

      const response: APIResponse<number> = {
        data: {
          storage: settings,
        },
      };
      res.status(200).json(response);
      return;
    } catch (error) {
      console.error(error);
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
}
