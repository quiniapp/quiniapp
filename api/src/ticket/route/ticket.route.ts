import { Request, RequestHandler, Response, Router } from 'express';
import { TicketController } from '../controller/ticket.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { newTicketSchema } from '@helper/schemas/ticket.schema';
import { USER_TYPE } from '@helper/types/user.type';

export class TicketRouter {
  public router: Router;
  private controller: TicketController;
  constructor() {
    this.router = Router();
    this.controller = new TicketController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/', this.getAllTicketHandler);
    this.router.get('/number', this.getAllTicketNumberHandler);
    this.router.get('/deleted', this.getAllDeletedTicketHandler);
    this.router.get('/:id', this.getTicketHandler);
    this.router.put('/:id', this.updateTicketHandler);
    this.router.post('/', this.newTicketHandler);
    this.router.delete('/:id', this.deleteTicketHandler);
  }

  private newTicketHandler: RequestHandler = async (req: Request, res: Response) => {
    const { newTicket } = req.body;
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
    if (!newTicket) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.BAD_REQUEST,
          message: ERROR_MESSAGE.BAD_REQUEST,
        },
      };
      res.status(400).json(response); // <-- SIN return

      return;
    }
    const result = newTicketSchema.safeParse(newTicket);
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
      const ticket = await this.controller.create(newTicket);
      const response: APIResponse<ITicketEntityFront> = {
        data: {
          ticket: ticket,
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

  private getTicketHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: ticket_id } = req.params;
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
      const ticket = await this.controller.get({
        ticket_id,
      });

      const response: APIResponse<ITicketEntityFront> = {
        data: {
          ticket,
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

  private getAllTicketHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date, ticket_number, cashier_id, winner } = req.query;
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
      let ticket;
      if (typeof ticket_number === 'string') {
        const res = await this.controller.get({
          ticket_number: ticket_number,
        });
        ticket = [res];
      } else {
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
        ticket = await this.controller.getAll({
          user_type: user.user.user_type,
          user_id: user.user.user_id,
          date: date,
          ...(typeof cashier_id === 'string' && { cashier_id: cashier_id }),
          ...(typeof winner === 'string' && winner === 'true'
            ? { winner: true }
            : { winner: false }),
        });
      }

      const response: APIResponse<ITicketEntityFront[]> = {
        data: {
          ticket,
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
          error.message === ERROR_MESSAGE.TICKET_NOT_FOUND
        ) {
          statusCode = 404;
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

  private getAllTicketNumberHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date, cashier_id, winner } = req.query;
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
      let ticket;

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
      ticket = await this.controller.getAllTicketNumber({
        user_type: user.user.user_type,
        user_id: user.user.user_id,
        date: date,
        ...(typeof cashier_id === 'string' && { cashier_id: cashier_id }),
        ...(typeof winner === 'string' && winner === 'true' ? { winner: true } : { winner: false }),
      });

      const response: APIResponse<{ ticket_id: string; ticket_number: string }[]> = {
        data: {
          ticket,
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
          error.message === ERROR_MESSAGE.TICKET_NOT_FOUND
        ) {
          statusCode = 404;
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

  private getAllDeletedTicketHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { date, cashier_id } = req.query;
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
      const ticket = await this.controller.getAllDeletedTickets({
        date,
        user_id: typeof cashier_id === 'string' ? cashier_id : undefined,
      });

      const response: APIResponse<number> = {
        data: {
          ticket,
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
          error.message === ERROR_MESSAGE.TICKET_NOT_FOUND
        ) {
          statusCode = 404;
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

  private updateTicketHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: ticket_id } = req.params;
    const { bets } = req.body;
    if (user?.user.user_type === USER_TYPE.CASHIER) {
      const response: APIResponse<undefined> = {
        error: {
          error: ERROR_TYPE.FORBIDDEN,
          message: ERROR_MESSAGE.FORBIDDEN,
        },
      };
      res.status(403).json(response);
      return;
    }

    /* const result = updateTicketSchema.safeParse(updateTicket);
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
      const ticket = await this.controller.update({ ticket_id, bets });
      const response: APIResponse<ITicketEntityFront> = {
        data: {
          ticket,
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

  private deleteTicketHandler: RequestHandler = async (req: Request, res: Response) => {
    const { id: ticket_number } = req.params;
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
      await this.controller.delete({
        ticket_number,
        user_type: user?.user?.user_type,
        user_id: user.user.user_id,
      });
      res.sendStatus(200);
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
