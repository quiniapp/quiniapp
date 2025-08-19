import { Request, RequestHandler, Response, Router } from 'express';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { CurrentAccountController } from '../controller/current-account.controller';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import { updateCurrentAccountSchema } from '@helper/schemas/current_account.schema';

export class CurrentAccountRouter {
  public router: Router;
  private controller: CurrentAccountController;
  constructor() {
    this.router = Router();
    this.controller = new CurrentAccountController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/:id', this.getCurrentAccountHandler);
    this.router.get('/', this.getAllCurrentAccountHandler);
    this.router.post('/:id', this.updateCurrentAccountHandler);
    this.router.post('/', this.calculateCurrentAccountHandler);
  }

  private getAllCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date } = req.query;
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
      const currentAccount = await this.controller.getAllCurrentAccountHandler({
        user_type: user.user.user_type,
        user_id: user.user.user_id,
        date: date as string,
      });

      const response: APIResponse<ICurrentAccountEntityFront[]> = {
        data: {
          currentAccount,
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

  private calculateCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date } = req.query;

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
      const currentaccount = await this.controller.calculateCurrentAccountHandler(date as string);
      const response: APIResponse<ICurrentAccountEntityFront> = {
        data: {
          currentaccount: currentaccount,
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

  private updateCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: current_account_id } = req.params;
    const { updateCurrentAccount } = req.body;
    if (!user?.user || !updateCurrentAccount) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: ERROR_MESSAGE.BAD_REQUEST,
        },
      };
      res.status(500).json(response);
      return;
    }
    const result = updateCurrentAccountSchema.safeParse(updateCurrentAccount);
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
      const currentaccount = await this.controller.updateCurrentAccountHandler(current_account_id, {
        ...updateCurrentAccount,
      });

      const response: APIResponse<ICurrentAccountEntityFront> = {
        data: {
          currentaccount,
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

  private getCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date } = req.query;
    // const { id } = req.params;

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
      const currentAccount = await this.controller.getCurrentAccountHandler({
        user_type: user.user.user_type,
        user_id: user.user.user_id,
        date: date as string,
      });

      const response: APIResponse<ICurrentAccountEntityFront[]> = {
        data: {
          currentAccount,
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
