import { Request, Response, Router } from 'express';
import { PollaBetController } from '../controller/polla-bet.controller';
import { APIResponse } from '@helper/response/api_response.response';
import { USER_TYPE } from '@helper/types/user.type';
import { IPollaBetEntityFront } from '@helper/types/polla-bet.type';
import { newPollaBetSchema, updatePollaBetSchema } from '@helper/schemas/polla-bet.schema';
import { BadRequestError, ForbiddenError, NotFoundError } from '@helper/errors';
import { asyncHandler } from '../../middlewares/error.middleware';

// Códigos lanzados por las funciones SQL (create_polla_bet, update_polla_bet_numbers,
// delete_polla_bet) — se mapean a errores HTTP legibles acá.
const mapPollaBetError = (error: unknown): Error => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('POLLA_BET_NOT_FOUND')) return new NotFoundError('Jugada de Polla');
  if (message.includes('POLLA_EDITION_NOT_FOUND')) return new NotFoundError('Edición de Polla');
  if (message.includes('POLLA_EDITION_NOT_ACTIVE'))
    return new BadRequestError('La edición de Polla ya no está activa');
  if (message.includes('POLLA_LOAD_LIMIT_EXCEEDED'))
    return new BadRequestError('Ya pasó la fecha límite de carga de esta edición');
  if (message.includes('POLLA_BET_ALREADY_WINNER'))
    return new BadRequestError('No se puede modificar una jugada que ya ganó');
  if (message.includes('POLLA_NUMBERS_MUST_BE_TEN'))
    return new BadRequestError('Debés elegir exactamente 10 números');
  return error instanceof Error ? error : new Error(message);
};

export class PollaBetRouter {
  public router: Router;
  private controller: PollaBetController;

  constructor() {
    this.router = Router();
    this.controller = new PollaBetController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/', this.getAllHandler);
    this.router.post('/', this.createHandler);
    this.router.put('/:id', this.updateHandler);
    this.router.delete('/:id', this.deleteHandler);
  }

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    const tokenUser = req.user!.user;
    const isCashier = tokenUser.user_type === USER_TYPE.CASHIER;

    const resolvedProps = isCashier
      ? { ...req.body, user_id: tokenUser.user_id, user_name: tokenUser.name }
      : req.body;

    const parsed = newPollaBetSchema.safeParse(resolvedProps);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.message);
    }

    try {
      const bet = await this.controller.create(parsed.data, req.organization_id!);
      const response: APIResponse<IPollaBetEntityFront> = { data: { bet } };
      res.status(200).json(response);
    } catch (error) {
      throw mapPollaBetError(error);
    }
  });

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const tokenUser = req.user!.user;
    const isCashier = tokenUser.user_type === USER_TYPE.CASHIER;
    const { polla_edition_id, lottery_id, schedule_id, date, cashier_id, ticket_number } =
      req.query;

    const bets = await this.controller.getAll({
      organization_id: req.organization_id!,
      user_id: isCashier
        ? tokenUser.user_id
        : typeof cashier_id === 'string'
          ? cashier_id
          : undefined,
      polla_edition_id: typeof polla_edition_id === 'string' ? polla_edition_id : undefined,
      lottery_id: typeof lottery_id === 'string' ? lottery_id : undefined,
      schedule_id: typeof schedule_id === 'string' ? schedule_id : undefined,
      date: typeof date === 'string' ? date : undefined,
      ticket_number: typeof ticket_number === 'string' ? ticket_number : undefined,
    });

    const response: APIResponse<IPollaBetEntityFront[]> = { data: { bet: bets } };
    res.status(200).json(response);
  });

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    const tokenUser = req.user!.user;
    if (tokenUser.user_type === USER_TYPE.CASHIER) {
      throw new ForbiddenError('Los cajeros no pueden editar jugadas de Polla');
    }

    const { id } = req.params;
    const parsed = updatePollaBetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.message);
    }

    try {
      const bet = await this.controller.update(id, parsed.data, req.organization_id!);
      const response: APIResponse<IPollaBetEntityFront> = { data: { bet } };
      res.status(200).json(response);
    } catch (error) {
      throw mapPollaBetError(error);
    }
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    const tokenUser = req.user!.user;
    if (tokenUser.user_type === USER_TYPE.CASHIER) {
      throw new ForbiddenError('Los cajeros no pueden borrar jugadas de Polla');
    }

    const { id } = req.params;

    try {
      await this.controller.delete(id, req.organization_id!, tokenUser.user_id);
      res.status(200).json({ data: { deleted: true } });
    } catch (error) {
      throw mapPollaBetError(error);
    }
  });
}
