import { Request, Response, Router } from 'express';
import { LotteryController } from '../controller/lottery.controller';
import { RequestHandler } from 'express-serve-static-core';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { updateLotterySchema } from '@helper/schemas/lottery.schema';
import { SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';

export class LotteryRouter {
  public router: Router;
  private controller: LotteryController;

  constructor() {
    this.router = Router();
    this.controller = new LotteryController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/', this.getAllLotteryHandler);
    this.router.post('/', this.newLotteryHandler);
    this.router.put('/:id', this.updateLotteryHandler);
    this.router.delete('/:id', this.deleteLotteryHandler);
  }

  private newLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { name } = req.body;
    const user = req.user;

    if (!name || typeof name !== 'string') {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.NAME_IS_REQUIRED, message: ERROR_MESSAGE.NAME_IS_REQUIRED },
      };
      res.status(400).json(response);
      return;
    }

    if ([USER_TYPE.CASHIER, USER_TYPE.ADMIN].includes(user?.user.user_type as USER_TYPE)) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const lottery = await this.controller.create({ name }, req.organization_id!);
      const response: APIResponse<ILotteryEntityFront> = { data: { lottery } };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: { error: ERROR_TYPE.AUTH_ERROR, message: (error as Error).message },
      });
    }
  };

  private getAllLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const allFlag = !!req.query.all;
    const dayParam = req.query.day as string | undefined;

    if (!user?.user) {
      res.status(500).json({
        error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST },
      });
      return;
    }

    let day: SCHEDULE_DAY | undefined;
    if (dayParam) {
      if (!(dayParam in SCHEDULE_DAY)) {
        res.status(400).json({
          error: {
            error: ERROR_TYPE.BAD_REQUEST,
            message: `Invalid day parameter: ${dayParam}. Must be one of: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY`,
          },
        });
        return;
      }
      day = SCHEDULE_DAY[dayParam as keyof typeof SCHEDULE_DAY];
    }

    try {
      const lottery =
        day !== undefined
          ? await this.controller.getAllByDay(day, allFlag, req.organization_id!)
          : await this.controller.getAll(allFlag, req.organization_id);

      const response: APIResponse<ILotteryEntityFront[]> = { data: { lottery } };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: { error: ERROR_TYPE.AUTH_ERROR, message: (error as Error).message },
      });
    }
  };

  private updateLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: lottery_id } = req.params;
    const { updateLottery } = req.body;

    if ([USER_TYPE.CASHIER, USER_TYPE.ADMIN].includes(user?.user.user_type as USER_TYPE)) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    const result = updateLotterySchema.safeParse(updateLottery);
    if (!result.success) {
      res.status(400).json({
        error: { error: ERROR_TYPE.BAD_REQUEST, message: String(result.error.message) },
      });
      return;
    }

    try {
      const lottery = await this.controller.update(lottery_id, updateLottery, req.organization_id!);
      const response: APIResponse<ILotteryEntityFront> = { data: { lottery } };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: { error: ERROR_TYPE.AUTH_ERROR, message: (error as Error).message },
      });
    }
  };

  private deleteLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: lottery_id } = req.params;

    if ([USER_TYPE.CASHIER, USER_TYPE.ADMIN].includes(user?.user.user_type as USER_TYPE)) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    try {
      await this.controller.delete({ lottery_id }, req.organization_id!);
      res.status(200).json({ data: { deleted: true } });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: { error: ERROR_TYPE.AUTH_ERROR, message: (error as Error).message },
      });
    }
  };
}
