import { Request, RequestHandler, Response, Router } from 'express';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { CurrentAccountController } from '../controller/current-account.controller';
import { ICurrentAccountEntityFront } from '@helper/types/current_account.type';
import { USER_TYPE } from '@helper/types/user.type';
import { UserRepository } from '../../user/repository/user.repository';
// import { updateCurrentAccountSchema } from '@helper/schemas/current_account.schema';

// Helper opcional para parsear booleanos
const toBool = (v: unknown) => {
  if (typeof v !== 'string') return false;
  const s = v.trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
};

interface INetworkSummary {
  organization_id: string;
  organization_name: string;
  total_pass: number;
  total_successes: number;
  total_claims: number;
  total_collections: number;
  total_paid: number;
  total_balance: number;
  total_leave: number;
  total_drag: number;
  cashier_count: number;
}

export class CurrentAccountRouter {
  public router: Router;
  private controller: CurrentAccountController;
  private userRepository = new UserRepository();
  constructor() {
    this.router = Router();
    this.controller = new CurrentAccountController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/network/summary', this.getNetworkSummaryHandler);
    this.router.get('/:id', this.getCurrentAccountHandler);
    this.router.get('/', this.getAllCurrentAccountHandler);
    this.router.post('/calculate', this.calculateCurrentAccountHandler);
    this.router.post('/calculate/network', this.calculateNetworkCurrentAccountHandler);
    this.router.post('/liquidate', this.liquidateCurrentAccountHandler);
    this.router.post('/liquidate/network', this.liquidateNetworkCurrentAccountHandler);
    this.router.post('/', this.calculateCurrentAccountHandler); // Mantener por compatibilidad
    this.router.put('/bulk', this.bulkUpdateCurrentAccountHandler);
    this.router.put('/:id', this.updateCurrentAccountHandler);
  }

  private getAllCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date, include_network, group_id } = req.query;
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
      let effectiveOrgId = req.organization_id!;
      if (typeof group_id === 'string' && user.user.user_type !== USER_TYPE.CASHIER) {
        const descendants = await this.userRepository.getOrganizationDescendants(
          req.organization_id!
        );
        if (descendants.includes(group_id)) {
          effectiveOrgId = group_id;
        }
      }

      const currentAccount = await this.controller.getAllCurrentAccountNetworkHandler({
        user_type: user.user.user_type,
        user_id: user.user.user_id,
        date: date as string,
        organization_id: effectiveOrgId,
        include_network: toBool(include_network),
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

    // Validar que el usuario no sea CASHIER ni ADMIN
    if (user.user.user_type === USER_TYPE.CASHIER || user.user.user_type === USER_TYPE.ADMIN) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: 'Access denied: CASHIER and ADMIN users cannot perform this action',
        },
      };
      res.status(403).json(response);
      return;
    }

    try {
      // Calculate solo recalcula, no liquida (leave = false)
      const currentaccount = await this.controller.calculateCurrentAccountHandler(
        req.organization_id!,
        date as string,
        false,
        false
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

  private liquidateCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
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

    // Validar que el usuario no sea CASHIER ni ADMIN
    if (user.user.user_type === USER_TYPE.CASHIER || user.user.user_type === USER_TYPE.ADMIN) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: 'Access denied: CASHIER and ADMIN users cannot perform this action',
        },
      };
      res.status(403).json(response);
      return;
    }

    try {
      // Liquidate liquida y puede marcar como leave
      const currentaccount = await this.controller.calculateCurrentAccountHandler(
        req.organization_id!,
        date as string,
        typeof leave === 'string' && leave === 'true',
        true
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
    }

    // Validar que el usuario no sea CASHIER ni ADMIN
    if (user.user.user_type === USER_TYPE.CASHIER || user.user.user_type === USER_TYPE.ADMIN) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: 'Access denied: CASHIER and ADMIN users cannot perform this action',
        },
      };
      res.status(403).json(response);
      return;
    }
    try {
      const currentaccount = await this.controller.updateCurrentAccountHandler(
        current_account_id,
        updateCurrentAccount,
        req.organization_id!,
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
    const { id } = req.params;

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
        user_id: id,
        date: typeof date === 'string' ? date : undefined,
        organization_id: req.organization_id!,
      });

      const response: APIResponse<ICurrentAccountEntityFront> = {
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

    const leaveFlag = toBool(leave);

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

    // Validar que el usuario no sea CASHIER ni ADMIN
    if (user.user.user_type === USER_TYPE.CASHIER || user.user.user_type === USER_TYPE.ADMIN) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: 'Access denied: CASHIER and ADMIN users cannot perform this action',
        },
      };
      res.status(403).json(response);
      return;
    }

    // fecha requerida siempre (seguimos tu regla actual)
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

    // validar formato de updateCurrentAccount solo si viene y no es objeto
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
      // 1) Si hay updates, los aplico (si no, lo salto sin error)
      if (entries.length > 0) {
        const results = await Promise.allSettled(
          entries.map(([id, payload]) =>
            this.controller.updateCurrentAccountByUserHandler(id, payload, req.organization_id!)
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
      }

      // 2) Siempre ejecuto el cálculo del día (regla nueva: aunque no haya updates y leave=false)
      //    `liquidatedFlag` viaja al controller para tu lógica de "liquidado" del día.
      await this.controller.calculateCurrentAccountHandler(
        req.organization_id!,
        String(date),
        leaveFlag,
        true
      );

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

  // Network handlers for CAPITALIST users

  private calculateNetworkCurrentAccountHandler: RequestHandler = async (
    req: Request,
    res: Response
  ) => {
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

    // Only CAPITALIST and OWNER can calculate network
    if (user.user.user_type !== USER_TYPE.CAPITALIST && user.user.user_type !== USER_TYPE.OWNER) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: 'Access denied: Only CAPITALIST and OWNER can calculate network accounts',
        },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const currentaccount = await this.controller.calculateCurrentAccountNetworkHandler(
        req.organization_id!,
        date as string,
        false,
        false
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
        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.AUTH_ERROR,
            message: error.message,
          },
        };
        res.status(500).json(response);
        return;
      }
    }
  };

  private liquidateNetworkCurrentAccountHandler: RequestHandler = async (
    req: Request,
    res: Response
  ) => {
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

    // Only CAPITALIST and OWNER can liquidate network
    if (user.user.user_type !== USER_TYPE.CAPITALIST && user.user.user_type !== USER_TYPE.OWNER) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: 'Access denied: Only CAPITALIST and OWNER can liquidate network accounts',
        },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const currentaccount = await this.controller.calculateCurrentAccountNetworkHandler(
        req.organization_id!,
        date as string,
        typeof leave === 'string' && leave === 'true',
        true
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
        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.AUTH_ERROR,
            message: error.message,
          },
        };
        res.status(500).json(response);
        return;
      }
    }
  };

  private getNetworkSummaryHandler: RequestHandler = async (req: Request, res: Response) => {
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

    // Only CAPITALIST and OWNER can view network summary
    if (user.user.user_type !== USER_TYPE.CAPITALIST && user.user.user_type !== USER_TYPE.OWNER) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.AUTH_ERROR,
          message: 'Access denied: Only CAPITALIST and OWNER can view network summary',
        },
      };
      res.status(403).json(response);
      return;
    }

    try {
      const summary = await this.controller.getNetworkSummaryHandler(
        req.organization_id!,
        date as string
      );
      const response: APIResponse<INetworkSummary[]> = {
        data: {
          summary,
        },
      };
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.AUTH_ERROR,
            message: error.message,
          },
        };
        res.status(500).json(response);
        return;
      }
    }
  };
}
