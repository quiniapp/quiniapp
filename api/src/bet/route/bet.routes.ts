import { Request, RequestHandler, Response, Router } from 'express';
import { BetController } from '../controller/bet.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { TicketSums } from '@helper/request/bet.response';

export class BetRouter {
  public router: Router;

  private controller: BetController;

  constructor() {
    this.router = Router();
    this.controller = new BetController();
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
    } = req.query;
    const { user } = req;
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
      const result = await this.controller.getAllBets({
        date,
        schedule_id: typeof schedule_id === 'string' ? schedule_id : undefined,
        cashier_id:
          user?.user.user_type === USER_TYPE.CASHIER
            ? user.user.user_id
            : typeof cashier_id === 'string'
              ? cashier_id
              : undefined,
        lottery_id: typeof lottery_id === 'string' ? lottery_id : undefined,
        winners: winners === 'true' ? true : false,
        grouped: grouped === 'true' ? true : false,
        tern: tern === 'true' ? true : false,
        quatern: quatern === 'true' ? true : false,
        ticket_number: typeof ticket_number === 'string' ? ticket_number : undefined,
        page: typeof page === 'string' ? parseInt(page, 10) : 1,
        limit: typeof limit === 'string' ? parseInt(limit, 10) : 100,
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
    const { date, schedule_id, cashier_id, lottery_id } = req.query;
    const { user } = req;
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
      const total = await this.controller.getTotalAmount({
        date,
        schedule_id: typeof schedule_id === 'string' ? schedule_id : undefined,
        cashier_id:
          user?.user.user_type === USER_TYPE.CASHIER
            ? user.user.user_id
            : typeof cashier_id === 'string'
              ? cashier_id
              : undefined,
        lottery_id: typeof lottery_id === 'string' ? lottery_id : undefined,
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
    const { date, schedule_id, cashier_id, lottery_id } = req.query;
    const { user } = req;
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
      const total = await this.controller.getTotalPrize({
        date,
        schedule_id: typeof schedule_id === 'string' ? schedule_id : undefined,
        cashier_id:
          user?.user.user_type === USER_TYPE.CASHIER
            ? user.user.user_id
            : typeof cashier_id === 'string'
              ? cashier_id
              : undefined,
        lottery_id: typeof lottery_id === 'string' ? lottery_id : undefined,
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
    //TODO : add cashir id to cashier only can see its own ticket
    // const { user } = req;

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
      const total = await this.controller.getAmountsByTicket({
        ticket_number,
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
