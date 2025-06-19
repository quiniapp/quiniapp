import { Request, RequestHandler, Response, Router } from 'express';
import { APIResponse } from 'helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from 'helper/types/errors.type';

import { USER_TYPE } from 'helper/types/user.type';
import { WinnerController } from '../controller/winners.controller';
import { ITicketEntityFront } from 'helper/types/ticket.type';

export class WinnerRouter {
  public router: Router;
  private controller: WinnerController;
  constructor() {
    this.router = Router();
    this.controller = new WinnerController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/', this.getAllWinnersHandler);
    this.router.post('/', this.generateWinnersHandler);
  }

  private generateWinnersHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user?.user || user.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: ERROR_MESSAGE.BAD_REQUEST,
        },
      };
      res.status(500).json(response);
      return;
    }

    try {
      await this.controller.generateWinners();
      const response: APIResponse<boolean> = {
        data: {
          winner: true,
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

  private getAllWinnersHandler: RequestHandler = async (req: Request, res: Response) => {
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

    try {
      console.log('getAllWinners');
      const winners = await this.controller.getAllWinners({
        user_type: user.user.user_type,
        user_id: user.user.user_id,
      });

      const response: APIResponse<ITicketEntityFront[]> = {
        data: {
          winners,
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
