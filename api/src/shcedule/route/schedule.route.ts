import { Request, RequestHandler, Response, Router } from 'express';
import { ScheduleController } from '../controller/schedule.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { IScheduleEntityFront } from '@helper/types/schedule.type';
import { newScheduleSchema, updateScheduleSchema } from '@helper/schemas/schedule.schema';

// ====== Cache en memoria (sin TTL): solo cambia en POST/PUT/DELETE ======
type SchedulesCacheEntry = { payload: IScheduleEntityFront[]; etag: string };
let cache: SchedulesCacheEntry | null = null;
let etagCounter = 0; // sin crypto, cambia al invalidar
let inflight: Promise<SchedulesCacheEntry> | null = null; // evita N queries concurrentes

function makeEtag() {
  etagCounter += 1;
  return `W/"schedules-${etagCounter}"`;
}
function invalidate() {
  cache = null;
  // no recalculamos acá: lo hará el próximo GET on-demand
}
async function loadAndSet(controller: ScheduleController): Promise<SchedulesCacheEntry> {
  const data = await controller.getAll();
  cache = { payload: data, etag: makeEtag() };
  return cache;
}
async function ensureCache(controller: ScheduleController) {
  if (cache) return cache;
  if (!inflight) inflight = loadAndSet(controller).finally(() => (inflight = null));
  return inflight;
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
    const { user } = req;
    const { newSchedule } = req.body;

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
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
      const schedule = await this.controller.create(newSchedule);
      invalidate(); // 🔴 invalida cache (y cambia ETag en el próximo GET)
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
    if (!user?.user) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const snap = await ensureCache(this.controller);

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
      const schedule = await this.controller.update(schedule_id, updateSchedule);
      invalidate(); // 🔴
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
      await this.controller.delete({ schedule_id });
      invalidate(); // 🔴
      res.status(200).json({ data: { deleted: true } }); // (tenías un 200 sin body)
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
