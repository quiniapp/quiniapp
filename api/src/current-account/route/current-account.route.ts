import { Request, RequestHandler, Response, Router } from 'express';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { CurrentAccountController } from '../controller/current-account.controller';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
// import { updateCurrentAccountSchema } from '@helper/schemas/current_account.schema';

export class CurrentAccountRouter {
  public router: Router;
  private controller: CurrentAccountController;
  constructor() {
    this.router = Router();
    this.controller = new CurrentAccountController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/:id', this.getCurrentAccountHandler);
    this.router.get('/', this.getAllCurrentAccountHandler);
    this.router.post('/', this.calculateCurrentAccountHandler);
    this.router.put('/bulk', this.bulkUpdateCurrentAccountHandler);
    this.router.put('/:id', this.updateCurrentAccountHandler);
  }

  private getAllCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date } = req.query;
    if (!user?.user) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: ERROR_MESSAGE.BAD_REQUEST,
        },
      };
      res.status(500).json(response);
      return;
    }

    try {
      const currentAccount = await this.controller.getAllCurrentAccountHandler({
        user_type: user.user.user_type,
        user_id: user.user.user_id,
        date: date as string,
      });

      const response: APIResponse<ICurrentAccountEntityFront[]> = {
        data: {
          currentAccount,
        },
      };
      res.status(200).json(response);
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

  private calculateCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date, leave } = req.query;

    if (!user?.user) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: ERROR_MESSAGE.BAD_REQUEST,
        },
      };
      res.status(500).json(response);
      return;
    }

    try {
      const currentaccount = await this.controller.calculateCurrentAccountHandler(
        date as string,
        typeof leave === 'string' && leave === 'true'
      );
      const response: APIResponse<ICurrentAccountEntityFront> = {
        data: {
          currentaccount: currentaccount,
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

  private updateCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: current_account_id } = req.params;
    const { updateCurrentAccount } = req.body;
    const { leave } = req.query;
    if (!user?.user || !updateCurrentAccount) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: ERROR_MESSAGE.BAD_REQUEST,
        },
      };
      res.status(500).json(response);
      return;
    } /* 
    const result = updateCurrentAccountSchema.safeParse(updateCurrentAccount);
    if (!result.success) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: String(result.error.message),
        },
      };
      res.status(400).json(response); // <-- SIN return

      return;
    } */
    try {
      const currentaccount = await this.controller.updateCurrentAccountHandler(
        current_account_id,
        {
          ...updateCurrentAccount,
        },
        typeof leave === 'string' && leave === 'true'
      );

      const response: APIResponse<ICurrentAccountEntityFront> = {
        data: {
          currentaccount,
        },
      };
      res.status(200).json(response);
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

  private getCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date } = req.query;
    // const { id } = req.params;

    if (!user?.user) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: ERROR_MESSAGE.BAD_REQUEST,
        },
      };
      res.status(500).json(response);
      return;
    }

    try {
      const currentAccount = await this.controller.getCurrentAccountHandler({
        user_type: user.user.user_type,
        user_id: user.user.user_id,
        date: date as string,
      });

      const response: APIResponse<ICurrentAccountEntityFront[]> = {
        data: {
          currentAccount,
        },
      };
      res.status(200).json(response);
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
  private bulkUpdateCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date, leave } = req.query; // DD-MM-YYYY
    const leaveFlag = typeof leave === 'string' && leave.toLowerCase() === 'true';

    const body = req.body as {
      updateCurrentAccount?: Record<
        string,
        { claims?: number; paid?: number; collections?: number }
      >;
    };
    const updateCurrentAccount = body?.updateCurrentAccount;

    if (!user?.user) {
      const response: APIResponse<null> = {
        error: { error: ERROR_TYPE.AUTH_ERROR, message: ERROR_MESSAGE.INVALID_CREDENTIALS },
      };
      res.status(401).json(response);
      return;
    }

    // Validación de fecha si se va a calcular leave (o siempre si querés)
    if (!date || typeof date !== 'string') {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: 'Query param "date" (DD-MM-YYYY) es requerido',
        },
      };
      res.status(400).json(response);
      return;
    }

    // Validar formato de updateCurrentAccount SOLO si viene y no es objeto
    if (
      updateCurrentAccount !== undefined &&
      (typeof updateCurrentAccount !== 'object' || Array.isArray(updateCurrentAccount))
    ) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: 'Body must include "updateCurrentAccount" as an object when provided',
        },
      };
      res.status(400).json(response);
      return;
    }

    const entries = updateCurrentAccount ? Object.entries(updateCurrentAccount) : [];

    try {
      let updated: ICurrentAccountEntityFront[] = [];
      let failed: Array<{ id: string; error: string }> = [];

      if (entries.length > 0) {
        const results = await Promise.allSettled(
          entries.map(([id, payload]) =>
            this.controller.updateCurrentAccountHandler(
              id,
              { ...payload },
              leaveFlag // pasar flag por si también querés calcular leave en cada update
            )
          )
        );

        results.forEach((r, idx) => {
          const [id] = entries[idx];
          if (r.status === 'fulfilled') updated.push(r.value);
          else {
            const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
            failed.push({ id, error: reason });
          }
        });
      } else if (!leaveFlag) {
        // No hay updates y no se pidió leave -> es un bad request
        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.BAD_REQUEST,
            message: 'Debe enviar "updateCurrentAccount" o leave=true',
          },
        };
        res.status(400).json(response);
        return;
      }

      // Ejecutar el cálculo masivo del día (siempre que llegó date; leaveFlag decide si calcula leave)
      await this.controller.calculateCurrentAccountHandler(String(date), leaveFlag);

      const statusCode = failed.length ? 207 : 200;
      const response: APIResponse<{
        updated: ICurrentAccountEntityFront[];
        failed: Array<{ id: string; error: string }>;
      }> = {
        data: {
          result: { updated, failed },
        },
      };
      res.status(statusCode).json(response);
      return;
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      let statusCode = 500;
      if (
        message === ERROR_MESSAGE.USER_NOT_FOUND ||
        message === ERROR_MESSAGE.INVALID_CREDENTIALS
      ) {
        statusCode = 401;
      }
      const response: APIResponse<null> = {
        error: { error: ERROR_TYPE.AUTH_ERROR, message },
      };
      res.status(statusCode).json(response);
      return;
    }
  };
}
