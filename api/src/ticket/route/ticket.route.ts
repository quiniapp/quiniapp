import { Request, Response, Router } from 'express';
import { TicketController } from '../controller/ticket.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import { ITicketEntityFront } from '@helper/types/ticket.type';
import { newTicketSchema } from '@helper/schemas/ticket.schema';
import { USER_TYPE } from '@helper/types/user.type';
import { asyncHandler } from '../../middlewares/error.middleware';

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
    this.router.put('/paid/:id', this.payTicketHandler);
    this.router.put('/:id', this.updateTicketHandler);
    this.router.post('/', this.newTicketHandler);
    this.router.delete('/:id', this.deleteTicketHandler);
  }

  private newTicketHandler = asyncHandler(async (req: Request, res: Response) => {
    const { newTicket } = req.body;

    if (!newTicket) {
      throw new BadRequestError('Datos del ticket requeridos');
    }

    // Zod valida automáticamente y lanza error si falla
    newTicketSchema.parse(newTicket);

    const ticket = await this.controller.create(newTicket, req.organization_id!);
    const response: APIResponse<ITicketEntityFront> = {
      data: {
        ticket: ticket,
      },
    };
    res.status(200).json(response);
  });

  private getTicketHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id: ticket_id } = req.params;

    const ticket = await this.controller.get({ ticket_id }, req.organization_id!);

    const response: APIResponse<ITicketEntityFront> = {
      data: {
        ticket,
      },
    };
    res.status(200).json(response);
  });

  private getAllTicketHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req;
    const { date, ticket_number, cashier_id, winner, page, limit, paid } = req.query;

    if (typeof ticket_number === 'string') {
      const ticketData = await this.controller.get({ ticket_number }, req.organization_id!);
      const response: APIResponse<ITicketEntityFront[]> = {
        data: {
          ticket: [ticketData],
        },
      };
      res.status(200).json(response);
      return;
    }

    if (typeof date !== 'string') {
      throw new BadRequestError('Fecha requerida');
    }

    const result = await this.controller.getAll({
      user_type: user!.user.user_type,
      user_id: user!.user.user_id,
      organization_id: req.organization_id!,
      date: date,
      ...(typeof cashier_id === 'string' && { cashier_id: cashier_id }),
      ...(typeof winner === 'string' && winner === 'true' ? { winner: true } : { winner: false }),
      ...(typeof paid === 'undefined'
        ? paid
        : typeof paid === 'string' && paid === 'true'
          ? { paid: true }
          : { paid: false }),
      page: typeof page === 'string' ? parseInt(page, 10) : 1,
      limit: typeof limit === 'string' ? parseInt(limit, 10) : 100,
    });

    const response: APIResponse<typeof result> = {
      data: {
        ticket: result,
      },
    };
    res.status(200).json(response);
  });

  private getAllTicketNumberHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req;
    const { date, cashier_id, winner } = req.query;

    if (typeof date !== 'string') {
      throw new BadRequestError('Fecha requerida');
    }

    const ticket = await this.controller.getAllTicketNumber({
      user_type: user!.user.user_type,
      user_id: user!.user.user_id,
      organization_id: req.organization_id!,
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
  });

  private getAllDeletedTicketHandler = asyncHandler(async (req: Request, res: Response) => {
    const { date, cashier_id } = req.query;

    if (typeof date !== 'string') {
      throw new BadRequestError('Fecha requerida');
    }

    const ticket = await this.controller.getAllDeletedTickets({
      date,
      organization_id: req.organization_id!,
      user_id: typeof cashier_id === 'string' ? cashier_id : undefined,
    });

    const response: APIResponse<number> = {
      data: {
        ticket,
      },
    };
    res.status(200).json(response);
  });

  private updateTicketHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req;
    const { id: ticket_id } = req.params;
    const { bets } = req.body;

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      throw new ForbiddenError('Los cajeros no pueden actualizar tickets');
    }

    const ticket = await this.controller.update({ ticket_id, bets }, req.organization_id!);
    const response: APIResponse<ITicketEntityFront> = {
      data: {
        ticket,
      },
    };
    res.status(200).json(response);
  });

  private deleteTicketHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id: ticket_number } = req.params;
    const { user } = req;

    await this.controller.delete(
      {
        ticket_number,
        user_type: user!.user.user_type,
        user_id: user!.user.user_id,
      },
      req.organization_id!
    );

    const response: APIResponse<boolean> = {
      data: {
        success: true,
      },
    };
    res.status(200).json(response);
  });

  private payTicketHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req;
    const { id: ticket_number } = req.params;

    if (!ticket_number) {
      throw new BadRequestError('Número de ticket requerido');
    }

    const result = await this.controller.paid({
      ticket_number,
      user_id: user!.user.user_id,
      organization_id: req.organization_id!,
    });

    const response: APIResponse<typeof result> = {
      data: { result },
    };
    res.status(200).json(response);
  });
}
