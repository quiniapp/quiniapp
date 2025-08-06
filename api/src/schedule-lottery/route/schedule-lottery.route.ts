import { Request, RequestHandler, Response, Router } from 'express';
import { APIResponse } from '@helper/response/api_response.response';
// import { scheduleLotteriesSchema } from '@helper/schemas/schedule_lottery.schema';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { ScheduleLotteryController } from '../controller/schedule-lottery.controller';
import { IScheduleLotteryEntityFront, SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';

export class ScheduleLotteryRouter {
  public router: Router;

  private controller: ScheduleLotteryController;

  constructor() {
    this.router = Router();
    this.controller = new ScheduleLotteryController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.post('/', this.newScheduleLotteryHandler);
    this.router.get('/', this.getScheduleLotteryHandler);
  }

  private newScheduleLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
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

    /*     const result = scheduleLotteriesSchema.safeParse(scheduleLottery);
    if (!result.success) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: result.error.message,
        },
      };
      res.status(403).json(response);
      return;
    } */

    const deletePromises: Promise<void>[] = [];
    const insertData: Array<{ day: SCHEDULE_DAY; schedule_id: string; lottery_id: string }> = [];
    const lotteries: string[] = [];
    try {
      for (const dayStr of Object.keys(scheduleLottery)) {
        if (!dayStr) continue;
        const day = SCHEDULE_DAY[dayStr as keyof typeof SCHEDULE_DAY];
        const schedules = scheduleLottery[dayStr];
        for (const schedule_id of Object.keys(schedules)) {
          if (!schedule_id) continue;

          // 1. Borra la combinación
          deletePromises.push(this.controller.deleteAllForScheduleAndDay({ day, schedule_id }));
          // 2. Prepara el insert para cada lottery_id de esa combinación
          for (const lottery_id of schedules[schedule_id]) {
            if (!lottery_id) continue;
            if (!lotteries.includes(lottery_id)) lotteries.push(lottery_id);
            insertData.push({ day, schedule_id, lottery_id });
          }
        }
      }
      // 3. Ejecuta los deletes en paralelo
      await Promise.all(deletePromises);
      // 4. Insertá todo de una (bulk insert)
      let data: IScheduleLotteryEntityFront;
      if (insertData.length) {
        data = await this.controller.bulkInsert(insertData);
      }
      await this.controller.bulkActiveLotteries(lotteries);
      const response: APIResponse<IScheduleLotteryEntityFront> = {
        data: {
          scheduleLotteries: data!,
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

  private getScheduleLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
      const data = await this.controller.getAllScheduleLotteries();
      const response: APIResponse<IScheduleLotteryEntityFront> = {
        data: {
          scheduleLotteries: data!,
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
