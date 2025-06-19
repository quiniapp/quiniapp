import { Request, RequestHandler, Response, Router } from 'express';
import { APIResponse } from 'helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from 'helper/types/errors.type';
import { CurrentAccountController } from '../controller/current-account.controller';
import { ICurrentAccountEntityFront } from 'helper/types/current_account.type';
import { updateCurrentAccountSchema } from 'helper/schemas/current_account.schema';

const mockCurrentAccounts: ICurrentAccountEntityFront[] = [
  {
    current_account_id: 'ca1',
    user_id: 'u1',
    user_name: 'Juan Pérez',
    user_number: 101,
    pass: 5,
    successes: 3,
    claims: 1,
    subtotal: 1500.75,
    previous_balance: 500,
    collections: 800,
    paid: 300.75,
    total: 1800,
    drag: 0,
    leave: 0,
    date: '2025-06-01',
  },
  {
    current_account_id: 'ca2',
    user_id: 'u2',
    user_name: 'María García',
    user_number: 102,
    pass: 8,
    successes: 5,
    claims: 2,
    subtotal: 2000,
    previous_balance: 600,
    collections: 1000,
    paid: 400,
    total: 2200,
    drag: 0,
    leave: 0,
    date: '2025-06-02',
  },
  {
    current_account_id: 'ca3',
    user_id: 'u3',
    user_name: 'Carlos López',
    user_number: 103,
    pass: 3,
    successes: 1,
    claims: 0,
    subtotal: 750.5,
    previous_balance: 250,
    collections: 500,
    paid: 0.5,
    total: 1250,
    drag: 0,
    leave: 0,
    date: '2025-06-03',
  },
  {
    current_account_id: 'ca4',
    user_id: 'u4',
    user_name: 'Lucía Gómez',
    user_number: 104,
    pass: 7,
    successes: 4,
    claims: 2,
    subtotal: 1800,
    previous_balance: 300,
    collections: 1200,
    paid: 500,
    total: 2000,
    drag: 0,
    leave: 0,
    date: '2025-06-04',
  },
  {
    current_account_id: 'ca5',
    user_id: 'u5',
    user_name: 'Pedro Martínez',
    user_number: 105,
    pass: 6,
    successes: 3,
    claims: 1,
    subtotal: 950.25,
    previous_balance: 150,
    collections: 700,
    paid: 200,
    total: 1150,
    drag: 0,
    leave: 0,
    date: '2025-06-05',
  },
  {
    current_account_id: 'ca6',
    user_id: 'u6',
    user_name: 'Ana Torres',
    user_number: 106,
    pass: 2,
    successes: 1,
    claims: 0,
    subtotal: 1300,
    previous_balance: 400,
    collections: 900,
    paid: 100,
    total: 1700,
    drag: 0,
    leave: 0,
    date: '2025-06-06',
  },
  {
    current_account_id: 'ca7',
    user_id: 'u7',
    user_name: 'Diego Fernández',
    user_number: 107,
    pass: 9,
    successes: 6,
    claims: 3,
    subtotal: 2100.9,
    previous_balance: 500,
    collections: 1500,
    paid: 400.9,
    total: 2500,
    drag: 0,
    leave: 0,
    date: '2025-06-07',
  },
  {
    current_account_id: 'ca8',
    user_id: 'u8',
    user_name: 'Carla Ríos',
    user_number: 108,
    pass: 1,
    successes: 0,
    claims: 0,
    subtotal: 600,
    previous_balance: 200,
    collections: 300,
    paid: 100,
    total: 800,
    drag: 0,
    leave: 0,
    date: '2025-06-08',
  },
  {
    current_account_id: 'ca9',
    user_id: 'u9',
    user_name: 'Esteban Salas',
    user_number: 109,
    pass: 4,
    successes: 2,
    claims: 1,
    subtotal: 1600,
    previous_balance: 450,
    collections: 1000,
    paid: 150,
    total: 1850,
    drag: 0,
    leave: 0,
    date: '2025-06-09',
  },
  {
    current_account_id: 'ca10',
    user_id: 'u10',
    user_name: 'Florencia Vidal',
    user_number: 110,
    pass: 10,
    successes: 8,
    claims: 2,
    subtotal: 2500,
    previous_balance: 1000,
    collections: 2000,
    paid: 500,
    total: 3000,
    drag: 0,
    leave: 0,
    date: '2025-06-10',
  },
];

export class CurrentAccountRouter {
  public router: Router;
  private controller: CurrentAccountController;
  constructor() {
    this.router = Router();
    this.controller = new CurrentAccountController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/', this.getAllCurrentAccountHandler);
    this.router.post('/:id', this.updateCurrentAccountHandler);
    this.router.post('/', this.calculateCurrentAccountHandler);
  }

  private getAllCurrentAccountHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;

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
      // const currentaccount = await this.controller.getAllCurrentAccountHandler({
      //   user_type: user.user.user_type,
      //   user_id: user.user.user_id,
      // });

      const response: APIResponse<ICurrentAccountEntityFront[]> = {
        data: {
          mockCurrentAccounts,
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
      const currentaccount = await this.controller.calculateCurrentAccountHandler();
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
    }
    try {
      const currentaccount = await this.controller.updateCurrentAccountHandler(current_account_id, {
        ...updateCurrentAccount,
      });

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
}
