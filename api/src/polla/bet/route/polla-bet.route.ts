import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import {
  POLLA_USER_TYPE,
  IPollaSessionUser,
  isPollaAdminRole,
} from '@helper/polla/types/user.type';
import { IPollaBetPublic } from '@helper/polla/types/game.type';
import { newPollaBetSchema, updatePollaBetSchema } from '@helper/polla/schemas/game.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import {
  PollaBetRepository,
  PollaBetFilters,
  PollaBetRow,
  PollaBetSort,
  PollaBetTicketScope,
} from '../repository/polla-bet.repository';
import { PollaEditionRepository } from '../../edition/repository/polla-edition.repository';
import { parsePagination } from '../../helper/pagination';
import { resolveOptionalOrganizationId } from '../../helper/scope';
import { getPollaSession } from '../../middleware/polla-auth.middleware';

/** Nº de ticket completo (`<17 dígitos>-<pasador>`) o solo los 17 dígitos. */
const TICKET_SEARCH = /^\d{1,17}(-\d{1,6})?$/;

const queryString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const parseSort = (value: unknown): PollaBetSort => (value === 'recent' ? 'recent' : 'hits');

/**
 * Lo que ve un pasador o un jugador de cada jugada: quién la jugó y sus
 * aciertos, sin ids internos ni montos (los totales son solo de admin).
 */
const toPublicBet = (bet: PollaBetRow, viewer: IPollaSessionUser): IPollaBetPublic => ({
  polla_bet_id: bet.polla_bet_id,
  ticket_number: bet.ticket_number,
  polla_edition_id: bet.polla_edition_id,
  group_name: bet.group_name,
  cashier_name: bet.cashier_name,
  cashier_number: bet.cashier_number,
  client_name: bet.client_name,
  load_date: bet.load_date,
  numbers: bet.numbers,
  hit_dates: bet.hit_dates,
  hit_numbers: bet.hit_numbers,
  hits: bet.hits,
  winner: bet.winner,
  hit_date: bet.hit_date,
  prize: bet.winner ? Number(bet.prize) : 0,
  is_mine:
    bet.polla_user_id === viewer.polla_user_id ||
    (viewer.user_type === POLLA_USER_TYPE.CASHIER &&
      bet.cashier_polla_user_id === viewer.polla_user_id),
  can_edit: bet.polla_user_id === viewer.polla_user_id,
});

const forViewer = (bet: PollaBetRow, viewer: IPollaSessionUser) =>
  isPollaAdminRole(viewer.user_type) ? bet : toPublicBet(bet, viewer);

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
    this.router.get('/ticket/:ticketNumber', this.getByTicketHandler);
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
    const isAdmin = isPollaAdminRole(user.user_type);
    const onlyMine = req.query.mine === 'true';

    const editionId = queryString(req.query.polla_edition_id) ?? undefined;

    if (editionId) await this.assertEditionScope(user, editionId);

    // Pasadores y jugadores ven todas las jugadas de su organización (con
    // nombres y aciertos); "solo mías" es, para el pasador, lo imputado a él.
    const filters: PollaBetFilters = isAdmin
      ? {
          editionId,
          organizationId: resolveOptionalOrganizationId(user, req.query.polla_organization_id),
          cashierId: queryString(req.query.cashier_polla_user_id),
          userId: onlyMine ? user.polla_user_id : queryString(req.query.polla_user_id),
          groupId: queryString(req.query.polla_group_id),
          ticketNumber: queryString(req.query.ticket_number),
          loadDate: queryString(req.query.load_date),
          onlyWinners: req.query.winners === 'true',
        }
      : {
          editionId,
          organizationId: user.polla_organization_id,
          cashierId:
            onlyMine && user.user_type === POLLA_USER_TYPE.CASHIER ? user.polla_user_id : null,
          userId: onlyMine && user.user_type === POLLA_USER_TYPE.PLAYER ? user.polla_user_id : null,
          ticketNumber: queryString(req.query.ticket_number),
          onlyWinners: req.query.winners === 'true',
        };

    if (!filters.editionId && !filters.ticketNumber) {
      throw new BadRequestError('Elegí una edición o buscá por número de ticket');
    }

    const result = await this.repository.getAll(filters, pagination, {
      sort: parseSort(req.query.sort),
      cursor: queryString(req.query.cursor),
    });

    const data = result.data.map((bet) => forViewer(bet, user));

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

    res.status(200).json({ data: { bet: forViewer(bet, user) } });
  });

  /** Números de un ticket para repetirlo. Cada rol busca solo en lo suyo. */
  private getByTicketHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const ticketNumber = req.params.ticketNumber.trim();

    if (!TICKET_SEARCH.test(ticketNumber)) {
      throw new BadRequestError('Número de ticket inválido');
    }

    let scope: PollaBetTicketScope;
    if (isPollaAdminRole(user.user_type)) {
      scope = {
        organizationId: resolveOptionalOrganizationId(user, req.query.polla_organization_id),
      };
    } else if (user.user_type === POLLA_USER_TYPE.CASHIER) {
      scope = { organizationId: user.polla_organization_id, cashierId: user.polla_user_id };
    } else {
      scope = { organizationId: user.polla_organization_id, userId: user.polla_user_id };
    }

    const bet = await this.repository.getByTicketNumber(ticketNumber, scope);

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
      sort: 'recent',
    });

    const data = result.data.map((bet) => forViewer(bet, user));

    res.status(200).json({ data: { winners: { ...result, data } } });
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
