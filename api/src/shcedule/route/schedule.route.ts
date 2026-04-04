import { Request, RequestHandler, Response, Router } from 'express';
import { ScheduleController } from '../controller/schedule.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { newScheduleSchema, updateScheduleSchema } from '@helper/schemas/schedule.schema';
import { globalCacheManager } from 'src/cache/CacheManager';
import {
  getScheduleCacheKey,
  getScheduleDayCacheKey,
  invalidateScheduleRelated,
} from 'src/cache/cacheInvalidation';
import { SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';

// ====== Cache Manager para Schedules ======
function getCacheKey(organization_id: string, all: boolean) {
  return getScheduleCacheKey(organization_id, all);
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

    if ([USER_TYPE.CASHIER, USER_TYPE.ADMIN].includes(user?.user.user_type as USER_TYPE)) {
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
      invalidateScheduleRelated(req.organization_id!);
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
    const dayParam = req.query.day as string | undefined;
    const withLotteries = req.query.with_lotteries === 'true';

    if (!user?.user) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST },
      };
      res.status(403).json(response);
      return;
    }

    // Validate day parameter if provided
    let day: SCHEDULE_DAY | undefined;
    if (dayParam) {
      if (!(dayParam in SCHEDULE_DAY)) {
        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.BAD_REQUEST,
            message: `Invalid day parameter: ${dayParam}. Must be one of: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY`,
          },
        };
        res.status(400).json(response);
        return;
      }
      day = SCHEDULE_DAY[dayParam as keyof typeof SCHEDULE_DAY];
    }

    try {
      // If day filter is provided, fetch filtered schedules with server-side cache
      if (day !== undefined) {
        const dayKey = getScheduleDayCacheKey(req.organization_id!, day, allFlag, withLotteries);
        const snap = await globalCacheManager.getOrLoad(
          dayKey,
          () => this.controller.getAllByDay(day!, allFlag, req.organization_id!, withLotteries),
          { ttl: 60_000, etagStrategy: 'counter' }
        );

        const inm = req.headers['if-none-match'];
        if (inm && inm === snap.etag) {
          res.status(304).end();
          return;
        }

        const response: APIResponse<IScheduleEntityFront[]> = {
          data: { schedule: snap.payload },
        };
        res.setHeader('ETag', snap.etag);
        res.setHeader('Cache-Control', 'private, no-cache');
        res.status(200).json(response);
        return;
      }

      // Original caching logic for non-filtered queries
      const key = getCacheKey(req.organization_id!, allFlag);
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

    if ([USER_TYPE.CASHIER, USER_TYPE.ADMIN].includes(user?.user.user_type as USER_TYPE)) {
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
      invalidateScheduleRelated(req.organization_id!);
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

    if ([USER_TYPE.CASHIER, USER_TYPE.ADMIN].includes(user?.user.user_type as USER_TYPE)) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    try {
      await this.controller.delete({ schedule_id }, req.organization_id!);
      invalidateScheduleRelated(req.organization_id!);
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
