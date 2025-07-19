import { Request, RequestHandler, Response, Router } from 'express';
import { BetController } from '../controller/bet.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { IBetEntityFront } from '@helper/types/bet.type';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';

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
    // this.router.post('/', this.controller.create);
    // this.router.put('/:id', this.controller.update);
    // this.router.delete('/:id', this.controller.delete);
  }

  private getAllBets: RequestHandler = async (req: Request, res: Response) => {
    const { date, schedule_id, cashier_id, lottery_id } = req.query;
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
      const bets = await this.controller.getAllBets({
        date,
        schedule_id: typeof schedule_id === 'string' ? schedule_id : undefined,
        cashier_id: typeof cashier_id === 'string' ? cashier_id : undefined,
        lottery_id: typeof lottery_id === 'string' ? lottery_id : undefined,
      });
      const response: APIResponse<IBetEntityFront[]> = {
        data: {
          bets,
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
