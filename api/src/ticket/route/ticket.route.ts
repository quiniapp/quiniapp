import { Request, RequestHandler, Response, Router } from 'express';
import { TicketController } from '../controller/ticket.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { newTicketSchema } from '@helper/schemas/ticket.schema';

export class TicketRouter {
  public router: Router;
  private controller: TicketController;
  constructor() {
    this.router = Router();
    this.controller = new TicketController();
    this.setupRoutes();
  }

  private setupRoutes() {
    // this.router.get('/:id', this.controller.get);
    this.router.get('/', this.getAllTicketHandler);
    this.router.get('/:id', this.getTicketHandler);
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
    const { ticket_number } = req.query;
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
        ...(ticket_number && { ticket_number: +ticket_number }),
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
      const ticket = await this.controller.getAll({
        user_type: user.user.user_type,
        user_id: user.user.user_id,
      });

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
  /*   private updateTicketHandler: RequestHandler = async (req: Request, res: Response) => {
    const { user } = req;
    const { id: ticket_id } = req.params;
    const { updateTicket } = req.body;
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

    const result = updateTicketSchema.safeParse(updateTicket);
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
      const ticket = await this.controller.update(ticket_id, updateTicket);
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
  }; */

  private deleteTicketHandler: RequestHandler = async (req: Request, res: Response) => {
    const { id: ticket_id } = req.params;
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
        ticket_id,
        user_type: user?.user?.user_type,
        user_id: user.user.user_id,
      });
      res.status(200);
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
