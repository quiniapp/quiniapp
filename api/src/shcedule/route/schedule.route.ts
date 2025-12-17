import { Request, RequestHandler, Response, Router } from 'express';
import { ScheduleController } from '../controller/schedule.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { newScheduleSchema, updateScheduleSchema } from '@helper/schemas/schedule.schema';
import { globalCacheManager } from 'src/cache/CacheManager';
import { invalidateScheduleLotteries } from 'src/schedule-lottery/route/schedule-lottery.route';
import { invalidateAllLotteries } from 'src/lottery/route/lottery.route';

// ====== Cache Manager para Schedules ======
const CACHE_KEY = 'schedules:all';

export function invalidateSchedules() {
  globalCacheManager.invalidate(CACHE_KEY);
  globalCacheManager.invalidate(`${CACHE_KEY}:all=true`);
}

export class ScheduleRouter {
  public router: Router;

  private controller: ScheduleController;

  constructor() {
    this.router = Router();
    this.controller = new ScheduleController();
    this.setupRoutes();
  }

  private setupRoutes() {
    // this.router.get('/:id', this.getScheduleHandler);
    this.router.get('/', this.getAllScheduleHandler);
    this.router.post('/', this.newSchedulehandler);
    this.router.put('/:id', this.updateScheduleHandler);
    this.router.delete('/:id', this.deleteScheduleHandler);
  }

  private newSchedulehandler: RequestHandler = async (req: Request, res: Response) => {
    const { user, organization_id } = req;
    const { newSchedule } = req.body;

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }
    if (!organization_id) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST },
      };
      res.status(403).json(response);
      return;
    }

    const result = newScheduleSchema.safeParse(newSchedule);
    if (!result.success) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.BAD_REQUEST, message: String(result.error.message) },
      };
      res.status(400).json(response);
      return;
    }

    try {
      const schedule = await this.controller.create(newSchedule, req.organization_id!);
      invalidateScheduleLotteries();
      invalidateAllLotteries();
      invalidateSchedules();
      const response: APIResponse<IScheduleEntityFront> = { data: { schedule } };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        let statusCode = 500;
        if (
          error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
          error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
        )
          statusCode = 401;
        const response: APIResponse<null> = {
          error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
        };
        res.status(statusCode).json(response);
      }
    }
  };

  private getAllScheduleHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const allFlag = !!req.query.all;

    if (!user?.user) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const key = allFlag ? `${CACHE_KEY}:all=true` : CACHE_KEY;
      const snap = await globalCacheManager.getOrLoad(
        key,
        () => this.controller.getAll(req.organization_id!, allFlag),
        {
          etagStrategy: 'counter',
        }
      );

      // ETag/304: si el cliente tiene la versión actual, no enviamos payload
      const inm = req.headers['if-none-match'];
      if (inm && inm === snap.etag) {
        res.status(304).end();
        return;
      }

      const response: APIResponse<IScheduleEntityFront[]> = { data: { schedule: snap.payload } };
      res.setHeader('ETag', snap.etag);
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate'); // sin TTL
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        let statusCode = 500;
        if (
          error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
          error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
        )
          statusCode = 401;
        const response: APIResponse<null> = {
          error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
        };
        res.status(statusCode).json(response);
      }
    }
  };

  private updateScheduleHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: schedule_id } = req.params;
    const { updateSchedule } = req.body;

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    const result = updateScheduleSchema.safeParse(updateSchedule);
    if (!result.success) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.BAD_REQUEST, message: String(result.error.message) },
      };
      res.status(400).json(response);
      return;
    }

    try {
      const schedule = await this.controller.update(
        schedule_id,
        updateSchedule,
        req.organization_id!
      );
      invalidateScheduleLotteries();
      invalidateAllLotteries();
      invalidateSchedules();
      const response: APIResponse<IScheduleEntityFront> = { data: { schedule } };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        let statusCode = 500;
        if (
          error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
          error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
        )
          statusCode = 401;
        const response: APIResponse<null> = {
          error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
        };
        res.status(statusCode).json(response);
      }
    }
  };

  private deleteScheduleHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: schedule_id } = req.params;

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    try {
      await this.controller.delete({ schedule_id }, req.organization_id!);
      invalidateScheduleLotteries();
      invalidateAllLotteries();
      invalidateSchedules();
      res.status(200).json({ data: { deleted: true } });
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        let statusCode = 500;
        if (
          error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
          error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
        )
          statusCode = 401;
        const response: APIResponse<null> = {
          error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
        };
        res.status(statusCode).json(response);
      }
    }
  };
}
