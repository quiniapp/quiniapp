import { Request, RequestHandler, Response, Router } from 'express';
import crypto from 'crypto';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { ScheduleLotteryController } from '../controller/schedule-lottery.controller';
import { IScheduleLotteryEntityFront, SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';

// ====== Cache simple en memoria ======
type SchedCache = {
  payload: IScheduleLotteryEntityFront['scheduleLotteries'];
  etag: string;
  expiresAt: number;
};
const TTL_MS = 5 * 60 * 1000; // 5 minutos (ajustable)
let cache: SchedCache | null = null;

// Recalcula y guarda en cache
async function refreshCache(controller: ScheduleLotteryController): Promise<SchedCache> {
  const data = await controller.getAllScheduleLotteries();
  // Generamos ETag a partir del contenido
  const bodyString = JSON.stringify(data ?? {});
  const etag = `W/"${crypto.createHash('sha1').update(bodyString).digest('hex')}"`;
  cache = {
    payload: data!,
    etag,
    expiresAt: Date.now() + TTL_MS,
  };
  return cache;
}

// Obtiene cache; si está vencido, vuelve a consultar sincronamente
async function getOrRefresh(controller: ScheduleLotteryController): Promise<SchedCache> {
  if (cache && cache.expiresAt > Date.now()) return cache;
  return await refreshCache(controller);
}

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

  // ====== POST: guarda e invalida cache ======
  private newScheduleLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { scheduleLottery } = req.body;

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    const deletePromises: Promise<void>[] = [];
    const insertData: Array<{ day: SCHEDULE_DAY; schedule_id: string; lottery_id: string }> = [];
    const lotteries: string[] = [];

    try {
      for (const dayStr of Object.keys(scheduleLottery ?? {})) {
        const day = SCHEDULE_DAY[dayStr as keyof typeof SCHEDULE_DAY];
        const schedules = scheduleLottery[dayStr] ?? {};
        for (const schedule_id of Object.keys(schedules)) {
          // 1) borro combinación
          deletePromises.push(this.controller.deleteAllForScheduleAndDay({ day, schedule_id }));
          // 2) preparo inserts
          for (const lottery_id of schedules[schedule_id] ?? []) {
            if (!lotteries.includes(lottery_id)) lotteries.push(lottery_id);
            insertData.push({ day, schedule_id, lottery_id });
          }
        }
      }

      await Promise.all(deletePromises);

      let data: IScheduleLotteryEntityFront['scheduleLotteries'] | undefined;
      if (insertData.length) {
        data = await this.controller.bulkInsert(insertData);
      }

      await this.controller.bulkActiveLotteries(lotteries);

      // ====== invalidación de cache ======
      cache = null; // aseguramos que el próximo GET refresque desde DB

      const response: APIResponse<IScheduleLotteryEntityFront> = {
        data: { scheduleLotteries: data! },
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
          error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
        };
        res.status(statusCode).json(response);
      }
    }
  };

  // ====== GET: sirve desde cache + ETag/304 ======
  private getScheduleLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    try {
      const snap = await getOrRefresh(this.controller);

      // Soporta If-None-Match para 304 (ahorra ancho de banda y CPU)
      const inm = req.headers['if-none-match'];
      if (inm && inm === snap.etag) {
        res.status(304).end();
        return;
      }

      const response: APIResponse<IScheduleLotteryEntityFront> = {
        data: { scheduleLotteries: snap.payload },
      };

      // Cache-Control/ETag para clientes/proxies (CDN opcional)
      res.setHeader('ETag', snap.etag);
      // max-age para clientes; stale-while-revalidate para proxies/CDN modernos
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

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
          error: { error: ERROR_TYPE.AUTH_ERROR, message: error.message },
        };
        res.status(statusCode).json(response);
      }
    }
  };
}
