import { Request, RequestHandler, Response, Router } from 'express';
import { APIResponse } from 'helper/response/api_response.response';
import { scheduleLotteriesSchema } from 'helper/schemas/schedule_lottery.schema';
import { ERROR_MESSAGE, ERROR_TYPE } from 'helper/types/errors.type';
import { USER_TYPE } from 'helper/types/user.type';
import { ScheduleLotteryController } from '../controller/schedule-lottery.controller';

export class ScheduleLotteryRouter {
  public router: Router;

  private controller: ScheduleLotteryController;

  constructor() {
    this.router = Router();
    this.controller = new ScheduleLotteryController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.post('/:id', this.scheduleLotteryHandler);
  }

  private scheduleLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { schedule_id } = req.params;
    const { user } = req;
    const { scheduleLottery } = req.body;

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

    const result = scheduleLotteriesSchema.safeParse(scheduleLottery);
    if (!result.success) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: result.error.message,
        },
      };
      res.status(403).json(response);
      return;
    }

    const { day, lotteries } = result.data;

    try {
      // 1. Borrar todas las relaciones existentes
      await this.controller.deleteAllForScheduleAndDay(schedule_id, day);

      // 2. Si hay nuevas, insertarlas
      if (lotteries.length > 0) {
        await this.controller.bulkInsert(schedule_id, day, lotteries);
      }

      res.status(200);
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
