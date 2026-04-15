import { Request, RequestHandler, Response, Router } from 'express';
import { ScheduleController } from '../controller/schedule.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { newScheduleSchema, updateScheduleSchema } from '@helper/schemas/schedule.schema';
import { SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';

export class ScheduleRouter {
  public router: Router;
  private controller: ScheduleController;

  constructor() {
    this.router = Router();
    this.controller = new ScheduleController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/', this.getAllScheduleHandler);
    this.router.post('/', this.newSchedulehandler);
    this.router.put('/:id', this.updateScheduleHandler);
    this.router.delete('/:id', this.deleteScheduleHandler);
  }

  private newSchedulehandler: RequestHandler = async (req: Request, res: Response) => {
    const { user, organization_id } = req;
    const { newSchedule } = req.body;

    if ([USER_TYPE.CASHIER, USER_TYPE.ADMIN].includes(user?.user.user_type as USER_TYPE)) {
      res.status(403).json({
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      });
      return;
    }

    if (!organization_id) {
      res.status(403).json({
        error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST },
      });
      return;
    }

    const result = newScheduleSchema.safeParse(newSchedule);
    if (!result.success) {
      res.status(400).json({
        error: { error: ERROR_TYPE.BAD_REQUEST, message: String(result.error.message) },
      });
      return;
    }

    try {
      const schedule = await this.controller.create(newSchedule, req.organization_id!);
      const response: APIResponse<IScheduleEntityFront> = { data: { schedule } };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: { error: ERROR_TYPE.AUTH_ERROR, message: (error as Error).message },
      });
    }
  };

  private getAllScheduleHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const allFlag = !!req.query.all;
    const dayParam = req.query.day as string | undefined;
    const withLotteries = req.query.with_lotteries === 'true';

    if (!user?.user) {
      res.status(403).json({
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
      const schedule =
        day !== undefined
          ? await this.controller.getAllByDay(day, allFlag, req.organization_id!, withLotteries)
          : await this.controller.getAll(req.organization_id!, allFlag);

      const response: APIResponse<IScheduleEntityFront[]> = { data: { schedule } };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: { error: ERROR_TYPE.AUTH_ERROR, message: (error as Error).message },
      });
    }
  };

  private updateScheduleHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: schedule_id } = req.params;
    const { updateSchedule } = req.body;

    if ([USER_TYPE.CASHIER, USER_TYPE.ADMIN].includes(user?.user.user_type as USER_TYPE)) {
      res.status(403).json({
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      });
      return;
    }

    const result = updateScheduleSchema.safeParse(updateSchedule);
    if (!result.success) {
      res.status(400).json({
        error: { error: ERROR_TYPE.BAD_REQUEST, message: String(result.error.message) },
      });
      return;
    }

    try {
      const schedule = await this.controller.update(
        schedule_id,
        updateSchedule,
        req.organization_id!
      );
      const response: APIResponse<IScheduleEntityFront> = { data: { schedule } };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: { error: ERROR_TYPE.AUTH_ERROR, message: (error as Error).message },
      });
    }
  };

  private deleteScheduleHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: schedule_id } = req.params;

    if ([USER_TYPE.CASHIER, USER_TYPE.ADMIN].includes(user?.user.user_type as USER_TYPE)) {
      res.status(403).json({
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      });
      return;
    }

    try {
      await this.controller.delete({ schedule_id }, req.organization_id!);
      res.status(200).json({ data: { deleted: true } });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: { error: ERROR_TYPE.AUTH_ERROR, message: (error as Error).message },
      });
    }
  };
}
