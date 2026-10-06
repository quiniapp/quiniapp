import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import {
  POLLA_USER_TYPE,
  IPollaSessionUser,
  isPollaAdminRole,
} from '@helper/polla/types/user.type';
import { IPollaBetPublic, IPollaDailySales } from '@helper/polla/types/game.type';
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
import { PollaUserRepository } from '../../user/repository/polla-user.repository';
import { parsePagination } from '../../helper/pagination';
import { pollaToday } from '../../helper/date';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { getPollaSession } from '../../middleware/polla-auth.middleware';

/** Nº de ticket completo (`<17 dígitos>-<pasador>`) o solo los 17 dígitos. */
const TICKET_SEARCH = /^\d{1,17}(-\d{1,6})?$/;

const queryString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const parseSort = (value: unknown): PollaBetSort => (value === 'recent' ? 'recent' : 'hits');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const queryDate = (value: unknown): string | null => {
  const date = queryString(value);
  if (date && !ISO_DATE.test(date)) {
    throw new BadRequestError('Fecha inválida (YYYY-MM-DD)');
  }
  return date;
};

/** Dueño de la jugada o, para un pasador, jugada imputada a él (sus jugadores). */
const isOwnOrImputed = (bet: PollaBetRow, viewer: IPollaSessionUser) =>
  bet.polla_user_id === viewer.polla_user_id ||
  (viewer.user_type === POLLA_USER_TYPE.CASHIER &&
    bet.cashier_polla_user_id === viewer.polla_user_id);

/**
 * Pasador y jugador borran lo suyo solo el día que se cargó: el pasador da de
 * baja lo que no le pagaron, sin tocar liquidaciones de días anteriores.
 */
const canDeleteOwn = (bet: PollaBetRow, viewer: IPollaSessionUser) =>
  isOwnOrImputed(bet, viewer) && !bet.winner && bet.load_date === pollaToday();

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
  is_mine: isOwnOrImputed(bet, viewer),
  // El monto de lo propio se ve (lo cobra el pasador); el de lo ajeno es un total.
  amount: isOwnOrImputed(bet, viewer) ? Number(bet.amount) : null,
  can_edit: bet.polla_user_id === viewer.polla_user_id,
  can_delete: canDeleteOwn(bet, viewer),
});

const forViewer = (bet: PollaBetRow, viewer: IPollaSessionUser) =>
  isPollaAdminRole(viewer.user_type) ? bet : toPublicBet(bet, viewer);

export class PollaBetRouter {
  public router: Router;

  private repository = new PollaBetRepository();

  private editionRepository = new PollaEditionRepository();

  private userRepository = new PollaUserRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/winners', this.getWinnersHandler);
    this.router.get('/sales', this.getDailySalesHandler);
    this.router.get('/last', this.getLastHandler);
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
          loadDate: queryDate(req.query.load_date),
          hitDate: queryDate(req.query.hit_date),
          onlyWinners: req.query.winners === 'true',
        }
      : {
          editionId,
          organizationId: user.polla_organization_id,
          cashierId:
            onlyMine && user.user_type === POLLA_USER_TYPE.CASHIER ? user.polla_user_id : null,
          userId: onlyMine && user.user_type === POLLA_USER_TYPE.PLAYER ? user.polla_user_id : null,
          ticketNumber: queryString(req.query.ticket_number),
          loadDate: queryDate(req.query.load_date),
          hitDate: queryDate(req.query.hit_date),
          onlyWinners: req.query.winners === 'true',
        };

    // Sin acotar por edición, ticket o día, el listado sería toda la historia.
    if (!filters.editionId && !filters.ticketNumber && !filters.loadDate && !filters.hitDate) {
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

  /** La última jugada propia, para "Repetir última jugada". */
  private getLastHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const bet = await this.repository.getLastByUser(user.polla_user_id);
    res.status(200).json({ data: { bet } });
  });

  /**
   * Boletas vendidas en el día. ADMIN+ ve el total de la organización y el
   * desglose por grupo; el pasador, solo lo imputado a él.
   */
  private getDailySalesHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);

    if (user.user_type === POLLA_USER_TYPE.PLAYER) {
      throw new ForbiddenError('Los jugadores no ven las ventas');
    }

    const date = queryString(req.query.date) ?? pollaToday();
    if (!ISO_DATE.test(date)) throw new BadRequestError('Fecha inválida (YYYY-MM-DD)');

    const isCashier = user.user_type === POLLA_USER_TYPE.CASHIER;
    const groups = await this.repository.getDailySales(
      resolveOrganizationId(user, req.query.polla_organization_id),
      date,
      isCashier ? user.polla_user_id : null
    );

    const sales: IPollaDailySales = {
      date,
      bets_count: groups.reduce((acc, group) => acc + group.bets_count, 0),
      amount: groups.reduce((acc, group) => acc + group.amount, 0),
      groups: isCashier ? null : groups,
    };

    res.status(200).json({ data: { sales } });
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

    // ADMIN+ carga a nombre de cualquier pasador o jugador de la organización
    // (la RPC valida la organización); el pasador, a su nombre o al de sus
    // jugadores; el jugador, solo a su nombre.
    if (targetUserId !== user.polla_user_id && !isPollaAdminRole(user.user_type)) {
      if (user.user_type !== POLLA_USER_TYPE.CASHIER) {
        throw new ForbiddenError('Solo podés cargar jugadas a tu nombre');
      }

      const target = await this.userRepository.getById(targetUserId);
      if (target.parent_polla_user_id !== user.polla_user_id) {
        throw new ForbiddenError('Solo podés cargar jugadas a nombre de tus jugadores');
      }
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

  /**
   * ADMIN y superiores pueden editar o borrar cualquier jugada, incluso pasada
   * la fecha límite. El resto edita solo las propias dentro del plazo, y borra
   * las propias (o, el pasador, las imputadas a él) solo el día de carga.
   */
  private assertCanWrite = async (
    user: IPollaSessionUser,
    betId: string,
    action: 'edit' | 'delete'
  ) => {
    const bet = await this.repository.getById(betId);

    if (
      user.user_type !== POLLA_USER_TYPE.OWNER &&
      bet.polla_organization_id !== user.polla_organization_id
    ) {
      throw new ForbiddenError('La jugada pertenece a otra organización');
    }

    if (isPollaAdminRole(user.user_type)) return bet;

    if (action === 'edit' && bet.polla_user_id !== user.polla_user_id) {
      throw new ForbiddenError('Solo podés modificar tus propias jugadas');
    }

    if (action === 'delete' && !isOwnOrImputed(bet, user)) {
      throw new ForbiddenError('Solo podés eliminar tus jugadas o las de tus jugadores');
    }

    return bet;
  };

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.assertCanWrite(user, req.params.id, 'edit');

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
    await this.assertCanWrite(user, req.params.id, 'delete');

    await this.repository.remove(
      req.params.id,
      user.polla_user_id,
      isPollaAdminRole(user.user_type)
    );

    res.status(200).json({ data: { success: true } });
  });
}
