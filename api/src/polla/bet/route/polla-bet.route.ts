import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import {
  POLLA_USER_TYPE,
  IPollaSessionUser,
  isPollaAdminRole,
} from '@helper/polla/types/user.type';
import { newPollaBetSchema, updatePollaBetSchema } from '@helper/polla/schemas/game.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaBetRepository, PollaBetFilters } from '../repository/polla-bet.repository';
import { PollaEditionRepository } from '../../edition/repository/polla-edition.repository';
import { parsePagination } from '../../helper/pagination';
import { resolveOptionalOrganizationId } from '../../helper/scope';
import { getPollaSession } from '../../middleware/polla-auth.middleware';

/**
 * Recorta la fila para un jugador: se queda con los números y los aciertos, y
 * solo revela el nombre si la jugada es suya o si ya ganó.
 */
const anonymize = (row: Record<string, unknown>, viewerId: string) => {
  const isMine = row.polla_user_id === viewerId;
  const isWinner = row.winner === true;

  const { polla_user_id: _ownerId, user_name, created_at: _createdAt, ...rest } = row;
  void _ownerId;
  void _createdAt;

  return {
    ...rest,
    is_mine: isMine,
    ...(isMine || isWinner ? { user_name } : {}),
  };
};

export class PollaBetRouter {
  public router: Router;

  private repository = new PollaBetRepository();

  private editionRepository = new PollaEditionRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/winners', this.getWinnersHandler);
    this.router.get('/', this.getAllHandler);
    this.router.get('/:id', this.getByIdHandler);
    this.router.post('/', this.createHandler);
    this.router.put('/:id', this.updateHandler);
    this.router.delete('/:id', this.deleteHandler);
  }

  private assertEditionScope = async (user: IPollaSessionUser, editionId: string) => {
    const edition = await this.editionRepository.getById(editionId);

    if (
      user.user_type !== POLLA_USER_TYPE.OWNER &&
      edition.polla_organization_id !== user.polla_organization_id
    ) {
      throw new ForbiddenError('La edición pertenece a otra organización');
    }

    return edition;
  };

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const isPlayer = user.user_type === POLLA_USER_TYPE.PLAYER;

    const editionId =
      typeof req.query.polla_edition_id === 'string' ? req.query.polla_edition_id : undefined;

    if (editionId) await this.assertEditionScope(user, editionId);

    // El jugador no filtra: solo elige edición y si quiere ver solo las suyas.
    const filters: PollaBetFilters = isPlayer
      ? {
          editionId,
          organizationId: user.polla_organization_id,
          userId: req.query.mine === 'true' ? user.polla_user_id : null,
        }
      : {
          editionId,
          organizationId: resolveOptionalOrganizationId(user, req.query.polla_organization_id),
          cashierId: (req.query.cashier_polla_user_id as string) ?? null,
          userId: (req.query.polla_user_id as string) ?? null,
          groupId: (req.query.polla_group_id as string) ?? null,
          ticketNumber: (req.query.ticket_number as string) ?? null,
          loadDate: (req.query.load_date as string) ?? null,
          onlyWinners: req.query.winners === 'true',
        };

    if (!filters.editionId && !filters.ticketNumber) {
      throw new BadRequestError('Elegí una edición o buscá por número de ticket');
    }

    const result = await this.repository.getAll(filters, pagination, {
      anonymous: isPlayer,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : null,
    });

    const data = isPlayer
      ? result.data.map((row) => anonymize(row, user.polla_user_id))
      : result.data;

    res.status(200).json({ data: { bets: { ...result, data } } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const bet = await this.repository.getById(req.params.id);

    if (
      user.user_type !== POLLA_USER_TYPE.OWNER &&
      bet.polla_organization_id !== user.polla_organization_id
    ) {
      throw new ForbiddenError('La jugada pertenece a otra organización');
    }

    if (user.user_type === POLLA_USER_TYPE.PLAYER) {
      res.status(200).json({
        data: { bet: anonymize(bet as unknown as Record<string, unknown>, user.polla_user_id) },
      });
      return;
    }

    res.status(200).json({ data: { bet } });
  });

  private getWinnersHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const editionId = req.query.polla_edition_id;

    if (typeof editionId !== 'string') {
      throw new BadRequestError('Falta la edición');
    }

    await this.assertEditionScope(user, editionId);
    const pagination = parsePagination(req.query as Record<string, unknown>);

    // Los ganadores se muestran con nombre a todos: es el resultado público.
    const result = await this.repository.getAll({ editionId, onlyWinners: true }, pagination, {
      anonymous: false,
    });

    res.status(200).json({ data: { winners: result } });
  });

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = newPollaBetSchema.parse(req.body);

    await this.assertEditionScope(user, payload.polla_edition_id);

    const targetUserId = payload.polla_user_id ?? user.polla_user_id;

    // Jugador y pasador solo cargan lo propio; ADMIN+ puede cargar por otro.
    if (targetUserId !== user.polla_user_id && !isPollaAdminRole(user.user_type)) {
      throw new ForbiddenError('Solo podés cargar jugadas a tu nombre');
    }

    const bet = await this.repository.create({
      editionId: payload.polla_edition_id,
      actorId: user.polla_user_id,
      targetUserId,
      numbers: payload.numbers,
      date: payload.date,
      force: isPollaAdminRole(user.user_type),
    });

    res.status(201).json({ data: { bet } });
  });

  private assertCanWrite = async (user: IPollaSessionUser, betId: string) => {
    const bet = await this.repository.getById(betId);

    if (
      user.user_type !== POLLA_USER_TYPE.OWNER &&
      bet.polla_organization_id !== user.polla_organization_id
    ) {
      throw new ForbiddenError('La jugada pertenece a otra organización');
    }

    // ADMIN y superiores pueden editar/borrar cualquier jugada, incluso pasada
    // la fecha límite. El resto, solo las propias y dentro del plazo.
    if (!isPollaAdminRole(user.user_type) && bet.polla_user_id !== user.polla_user_id) {
      throw new ForbiddenError('Solo podés modificar tus propias jugadas');
    }

    return bet;
  };

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.assertCanWrite(user, req.params.id);

    const { numbers } = updatePollaBetSchema.parse(req.body);

    const bet = await this.repository.updateNumbers(
      req.params.id,
      numbers,
      user.polla_user_id,
      isPollaAdminRole(user.user_type)
    );

    res.status(200).json({ data: { bet } });
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.assertCanWrite(user, req.params.id);

    await this.repository.remove(
      req.params.id,
      user.polla_user_id,
      isPollaAdminRole(user.user_type)
    );

    res.status(200).json({ data: { success: true } });
  });
}
