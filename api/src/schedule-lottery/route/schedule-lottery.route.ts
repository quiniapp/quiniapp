import { Request, RequestHandler, Response, Router } from 'express';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { ScheduleLotteryController } from '../controller/schedule-lottery.controller';
import { IScheduleLotteryEntityFront, SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';

export type ScheduleLotteryPayload = {
  scheduleLotteries: IScheduleLotteryEntityFront;
};

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

    if ([USER_TYPE.CASHIER, USER_TYPE.ADMIN].includes(user?.user.user_type as USER_TYPE)) {
      res.status(403).json({
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      });
      return;
    }

    if (!scheduleLottery || typeof scheduleLottery !== 'object') {
      res.status(400).json({
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: 'scheduleLottery is required and must be an object',
        },
      });
      return;
    }

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const dayKey of Object.keys(scheduleLottery)) {
      if (!(dayKey in SCHEDULE_DAY)) {
        res.status(400).json({
          error: {
            error: ERROR_TYPE.BAD_REQUEST,
            message: `Invalid day key: ${dayKey}. Must be one of: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY`,
          },
        });
        return;
      }

      const schedules = scheduleLottery[dayKey];
      if (!schedules || typeof schedules !== 'object') continue;

      for (const scheduleId of Object.keys(schedules)) {
        if (!uuidPattern.test(scheduleId)) {
          res.status(400).json({
            error: {
              error: ERROR_TYPE.BAD_REQUEST,
              message: `Invalid schedule_id format: ${scheduleId}. Must be a valid UUID`,
            },
          });
          return;
        }

        const lotteries = schedules[scheduleId];
        if (!Array.isArray(lotteries)) {
          res.status(400).json({
            error: {
              error: ERROR_TYPE.BAD_REQUEST,
              message: `Lotteries for schedule ${scheduleId} must be an array`,
            },
          });
          return;
        }

        for (const lotteryId of lotteries) {
          if (!uuidPattern.test(lotteryId)) {
            res.status(400).json({
              error: {
                error: ERROR_TYPE.BAD_REQUEST,
                message: `Invalid lottery_id format: ${lotteryId}. Must be a valid UUID`,
              },
            });
            return;
          }
        }
      }
    }

    try {
      const data = await this.controller.saveScheduleLottery(scheduleLottery, req.organization_id!);
      const response: APIResponse<IScheduleLotteryEntityFront> = {
        data: { scheduleLotteries: data },
      };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: { error: ERROR_TYPE.AUTH_ERROR, message: (error as Error).message },
      });
    }
  };

  private getScheduleLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
      const scheduleLotteries = await this.controller.getAllScheduleLotteries(req.organization_id!);
      const response: APIResponse<IScheduleLotteryEntityFront> = {
        data: { scheduleLotteries },
      };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: { error: ERROR_TYPE.AUTH_ERROR, message: (error as Error).message },
      });
    }
  };
}
