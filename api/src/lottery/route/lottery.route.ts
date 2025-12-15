import { Request, Response, Router } from 'express';
import { LotteryController } from '../controller/lottery.controller';
import { RequestHandler } from 'express-serve-static-core';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { updateLotterySchema } from '@helper/schemas/lottery.schema';
import { globalCacheManager } from 'src/cache/CacheManager';
// ====== Cache Manager para Lotteries ======
function keyFor(allFlag: boolean) {
  return `lotteries:all=${allFlag ? 'true' : 'false'}`;
}

function invalidateAllLotteries() {
  globalCacheManager.invalidate(keyFor(true));
  globalCacheManager.invalidate(keyFor(false));
}

export class LotteryRouter {
  public router: Router;
  private controller: LotteryController;
  constructor() {
    this.router = Router();
    this.controller = new LotteryController();
    this.setupRoutes();
  }

  private setupRoutes() {
    // this.router.get('/:id', this.controller.get);
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
    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const lottery = await this.controller.create({ name }, req.organization_id!);

      // invalidación (ambas variantes all=true/false)
      invalidateAllLotteries();

      const response: APIResponse<ILotteryEntityFront> = { data: { lottery } };
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

  private getAllLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const allFlag = !!req.query.all;

    if (!user?.user) {
      const response: APIResponse<null> = {
        error: { error: ERROR_TYPE.BAD_REQUEST, message: ERROR_MESSAGE.BAD_REQUEST },
      };
      res.status(500).json(response);
      return;
    }

    try {
      const key = keyFor(allFlag);
      const snap = await globalCacheManager.getOrLoad(
        key,
        () => this.controller.getAll(allFlag, req.organization_id),
        {
          etagStrategy: 'timestamp',
        }
      );

      // 304 si el cliente tiene la misma versión
      const inm = req.headers['if-none-match'];
      if (inm && inm === snap.etag) {
        res.status(304).end();
        return;
      }

      const response: APIResponse<ILotteryEntityFront[]> = {
        data: { lottery: snap.payload },
      };

      // "sin TTL": forzá revalidación de cliente/proxy via ETag
      // (el ETag sólo cambia en mutaciones)
      res.setHeader('ETag', snap.etag);
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

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

  private updateLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: lottery_id } = req.params;
    const { updateLottery } = req.body;

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    const result = updateLotterySchema.safeParse(updateLottery);
    if (!result.success) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.BAD_REQUEST, message: String(result.error.message) },
      };
      res.status(400).json(response);
      return;
    }

    try {
      const lottery = await this.controller.update(lottery_id, updateLottery, req.organization_id!);

      invalidateAllLotteries();

      const response: APIResponse<ILotteryEntityFront> = { data: { lottery } };
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

  private deleteLotteryHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: lottery_id } = req.params;

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: { error: ERROR_TYPE.FORBIDDEN, message: ERROR_MESSAGE.FORBIDDEN },
      };
      res.status(403).json(response);
      return;
    }

    try {
      await this.controller.delete({ lottery_id }, req.organization_id!);

      invalidateAllLotteries();

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
