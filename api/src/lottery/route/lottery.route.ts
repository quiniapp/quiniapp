import { Request, Response, Router } from 'express';
import { LotteryController } from '../controller/lottery.controller';
import { RequestHandler } from 'express-serve-static-core';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { ILotteryEntityFront } from '@helper/types/lottery.type';

export class LotteryRouter {
  public router: Router;
  private controller: LotteryController;
  constructor() {
    this.router = Router();
    this.controller = new LotteryController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/:id', this.controller.get);
    this.router.get('/', this.controller.getAll);
    this.router.post('/', this.newLotteryHandler);
    this.router.put('/:id', this.controller.update);
    this.router.delete('/:id', this.controller.delete);
  }

  private newLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { name } = req.body;
    const user = req.user;
    if (!name) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.NAME_IS_REQUIRED,
          message: ERROR_MESSAGE.NAME_IS_REQUIRED,
        },
      };
      res.status(400).json(response); // <-- SIN return

      return;
    }
    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
        },
      };
      res.status(400).json(response); // <-- SIN return

      return;
    }
    try {
      const lottery = await this.controller.create({ name });
      const response: APIResponse<ILotteryEntityFront> = {
        data: {
          lottery: lottery,
        },
      };
      res.status(200).json(response);
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
