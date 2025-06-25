import { Request, RequestHandler, Response, Router } from 'express';
import { ScheduleLotteryController } from '../controller/schedulelottery.controller';
import { APIResponse } from 'helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from 'helper/types/errors.type';
import { USER_TYPE } from 'helper/types/user.type';
import { IScheduleLotteryEntityFront } from 'helper/types/schedulelottery.type';
import { newScheduleLotterySchema, updateScheduleLotterySchema } from 'helper/schemas/schedulelottery.schema';

export class ScheduleLotteryRouter {
  public router: Router;

  private controller: ScheduleLotteryController;

  constructor() {
    this.router = Router();
    this.controller = new ScheduleLotteryController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.post('/:id', this.newScheduleLotteryHandler);
    this.router.put('/:id', this.updateScheduleLotteryHandler);
    this.router.delete('/:id', this.deleteScheduleLotteryHandler);
  }

  private newScheduleLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const {id:schedule_id} = req.params
    const { user } = req;
    const { newScheduleLottery } = req.body;
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

    const result = newScheduleLotterySchema.safeParse(newScheduleLottery);
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
      const schedulelottery = await this.controller.create(newScheduleLottery);
      const response: APIResponse<IScheduleLotteryEntityFront> = {
        data: {
          schedulelottery,
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


  private updateScheduleLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: schedulelottery_id } = req.params;
    const { updateScheduleLottery } = req.body;
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

    const result = updateScheduleLotterySchema.safeParse(updateScheduleLottery);
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
      const schedulelottery = await this.controller.update(schedulelottery_id, updateScheduleLottery);
      const response: APIResponse<IScheduleLotteryEntityFront> = {
        data: {
          schedulelottery,
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
  private deleteScheduleLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: schedulelottery_id } = req.params;
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
      await this.controller.delete({ schedulelottery_id });
      res.status(200);
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
