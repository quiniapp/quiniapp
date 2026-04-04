import { Request, RequestHandler, Response, Router } from 'express';
import { BetController } from '../controller/bet.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { TicketSums } from '@helper/request/bet.request';
import { UserRepository } from '../../user/repository/user.repository';

export class BetRouter {
  public router: Router;

  private controller: BetController;
  private userRepository: UserRepository;

  constructor() {
    this.router = Router();
    this.controller = new BetController();
    this.userRepository = new UserRepository();
    this.setupRoutes();
  }

  private setupRoutes() {
    // this.router.get('/:id', this.controller.get);
    this.router.get('/', this.getAllBets);
    this.router.get('/group', this.getAllBets);
    this.router.get('/total', this.getTotalAmount);
    this.router.get('/prize', this.getTotalPrize);
    this.router.get('/amounts', this.getAmountsByTicket);
    // this.router.post('/', this.controller.create);
    // this.router.put('/:id', this.controller.update);
    // this.router.delete('/:id', this.controller.delete);
  }

  /**
   * All users now share the root organization_id.
   * Group scoping is handled via group_user_ids in resolveGroupFilter.
   */
  private getOrgIds = (req: Request): string[] => {
    return [req.organization_id!];
  };

  /**
   * Resolve group and cashier filters for bet queries.
   * Handles validation of group_id against authorized orgs and cashier_id against group users.
   */
  private async resolveGroupFilter(
    req: Request,
    group_id: unknown,
    cashier_id: unknown
  ): Promise<{
    organization_ids: string[];
    group_user_ids?: string[];
    effectiveCashierId?: string;
  }> {
    const organization_ids = [req.organization_id!];
    const { user } = req;

    // ADMIN with group (group_id !== organization_id): auto-scope, ignore query param
    if (
      user?.user.user_type === USER_TYPE.ADMIN &&
      user.user.group_id &&
      user.user.group_id !== req.organization_id
    ) {
      const adminGroupUserIds = await this.userRepository.getUserIdsByGroupId(
        user.user.group_id,
        req.organization_id!
      );

      let effectiveCashierId = typeof cashier_id === 'string' ? cashier_id : undefined;
      if (effectiveCashierId && !adminGroupUserIds.includes(effectiveCashierId)) {
        return { organization_ids, group_user_ids: ['__invalid__'] };
      }
      if (effectiveCashierId) {
        return { organization_ids, effectiveCashierId };
      }
      return { organization_ids, group_user_ids: adminGroupUserIds };
    }

    let group_user_ids: string[] | undefined;
    if (typeof group_id === 'string' && user?.user.user_type !== USER_TYPE.CASHIER) {
      group_user_ids = await this.userRepository.getUserIdsByGroupId(
        group_id,
        req.organization_id!
      );
    }

    let effectiveCashierId =
      user?.user.user_type === USER_TYPE.CASHIER
        ? user.user.user_id
        : typeof cashier_id === 'string'
          ? cashier_id
          : undefined;

    if (effectiveCashierId && group_user_ids) {
      if (!group_user_ids.includes(effectiveCashierId)) {
        group_user_ids = ['__invalid__'];
        effectiveCashierId = undefined;
      } else {
        group_user_ids = undefined;
      }
    }

    return { organization_ids, group_user_ids, effectiveCashierId };
  }

  private getAllBets: RequestHandler = async (req: Request, res: Response) => {
    const {
      date,
      schedule_id,
      cashier_id,
      lottery_id,
      winners,
      grouped,
      tern,
      quatern,
      ticket_number,
      page,
      limit,
      group_id,
      min_amount,
    } = req.query;
    if (typeof date !== 'string') {
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
      const { organization_ids, group_user_ids, effectiveCashierId } =
        await this.resolveGroupFilter(req, group_id, cashier_id);

      const result = await this.controller.getAllBets({
        date,
        schedule_id: typeof schedule_id === 'string' ? schedule_id : undefined,
        cashier_id: effectiveCashierId,
        lottery_id: typeof lottery_id === 'string' ? lottery_id : undefined,
        winners: winners === 'true' ? true : false,
        grouped: grouped === 'true' ? true : false,
        tern: tern === 'true' ? true : false,
        quatern: quatern === 'true' ? true : false,
        ticket_number: typeof ticket_number === 'string' ? ticket_number : undefined,
        page: typeof page === 'string' ? parseInt(page, 10) : 1,
        limit: typeof limit === 'string' ? Math.max(1, parseInt(limit, 10) || 100) : 100,
        min_amount: typeof min_amount === 'string' ? Math.max(0, parseFloat(min_amount) || 0) : 0,
        organization_ids,
        group_user_ids,
      });
      const response: APIResponse<typeof result> = {
        data: {
          bets: result,
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

  private getTotalAmount: RequestHandler = async (req: Request, res: Response) => {
    const { date, schedule_id, cashier_id, lottery_id, group_id } = req.query;
    if (typeof date !== 'string') {
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
      const { organization_ids, group_user_ids, effectiveCashierId } =
        await this.resolveGroupFilter(req, group_id, cashier_id);

      const total = await this.controller.getTotalAmount({
        date,
        schedule_id: typeof schedule_id === 'string' ? schedule_id : undefined,
        cashier_id: effectiveCashierId,
        lottery_id: typeof lottery_id === 'string' ? lottery_id : undefined,
        organization_ids,
        group_user_ids,
      });
      const response: APIResponse<number> = {
        data: {
          total,
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

  private getTotalPrize: RequestHandler = async (req: Request, res: Response) => {
    const { date, schedule_id, cashier_id, lottery_id, group_id } = req.query;
    if (typeof date !== 'string') {
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
      const { organization_ids, group_user_ids, effectiveCashierId } =
        await this.resolveGroupFilter(req, group_id, cashier_id);

      const total = await this.controller.getTotalPrize({
        date,
        schedule_id: typeof schedule_id === 'string' ? schedule_id : undefined,
        cashier_id: effectiveCashierId,
        lottery_id: typeof lottery_id === 'string' ? lottery_id : undefined,
        organization_ids,
        group_user_ids,
      });
      const response: APIResponse<number> = {
        data: {
          total,
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

  private getAmountsByTicket: RequestHandler = async (req: Request, res: Response) => {
    const { ticket_number } = req.query;

    if (typeof ticket_number !== 'string') {
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
      const allOrgIds = await this.getOrgIds(req);

      const total = await this.controller.getAmountsByTicket({
        ticket_number,
        organization_ids: allOrgIds,
      });
      const response: APIResponse<TicketSums> = {
        data: {
          total,
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
}
