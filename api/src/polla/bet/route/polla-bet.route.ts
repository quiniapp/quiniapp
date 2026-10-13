import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import {
  POLLA_USER_TYPE,
  POLLA_STAFF_ROLES,
  IPollaSessionUser,
  isPollaAdminRole,
} from '@helper/polla/types/user.type';
import {
  IPollaBetPublic,
  IPollaDailySales,
  IPollaTicketCheck,
  IPollaTicketHolder,
} from '@helper/polla/types/game.type';
import { newPollaBetSchema, updatePollaBetSchema } from '@helper/polla/schemas/game.schema';
import {
  POLLA_ACCOUNT_RECALC_MAX_DAYS,
  POLLA_EXPORT_PAGE_SIZE,
} from '@helper/polla/config/session.config';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import {
  PollaBetRepository,
  PollaBetFilters,
  PollaBetRow,
  PollaBetSort,
  PollaBetTicketScope,
} from '../repository/polla-bet.repository';
import { PollaEditionRepository } from '../../edition/repository/polla-edition.repository';
import { PollaCurrentAccountRepository } from '../../current-account/repository/polla-current-account.repository';
import { parsePagination } from '../../helper/pagination';
import { isPollaLoadOpen, pollaToday } from '../../helper/date';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rango `desde`/`hasta` (los dos o ninguno), de hasta un período de liquidación. */
const queryDateRange = (fromValue: unknown, toValue: unknown) => {
  const from = queryDate(fromValue);
  const to = queryDate(toValue);

  if (!from && !to) return null;
  if (!from || !to || from > to) {
    throw new BadRequestError('Rango de fechas inválido');
  }
  if ((Date.parse(to) - Date.parse(from)) / DAY_MS > POLLA_ACCOUNT_RECALC_MAX_DAYS) {
    throw new BadRequestError(`El rango no puede pasar de ${POLLA_ACCOUNT_RECALC_MAX_DAYS} días`);
  }

  return { from, to };
};

/** Dueño de la jugada o, para un pasador, jugada imputada a él (sus jugadores). */
const isOwnOrImputed = (bet: PollaBetRow, viewer: IPollaSessionUser) =>
  bet.polla_user_id === viewer.polla_user_id ||
  (viewer.user_type === POLLA_USER_TYPE.CASHIER &&
    bet.cashier_polla_user_id === viewer.polla_user_id);

/** Lo que hace falta para saber si el pasador puede borrar cada jugada. */
interface DeleteContext {
  /** Ediciones con la carga abierta en este momento. */
  openEditions: Set<string>;
  /** Último día liquidado de la cuenta del pasador. */
  liquidatedUntil: string | null;
}

/**
 * Solo el pasador borra lo suyo (y lo de sus jugadores), hasta el cierre de
 * carga de la edición: da de baja lo que no le pagaron. Si su cuenta ya se
 * liquidó el día de carga o después, ya no (lo liquidado no cambia solo). La
 * RPC vuelve a controlar las dos cosas. El jugador no tiene acciones.
 */
const canDeleteOwn = (bet: PollaBetRow, viewer: IPollaSessionUser, ctx?: DeleteContext) =>
  ctx !== undefined &&
  viewer.user_type === POLLA_USER_TYPE.CASHIER &&
  isOwnOrImputed(bet, viewer) &&
  !bet.winner &&
  ctx.openEditions.has(bet.polla_edition_id) &&
  (!ctx.liquidatedUntil || bet.load_date > ctx.liquidatedUntil);

/** Si la jugó un jugador, el pasador al que se imputa es otro usuario: el suyo. */
const holderOf = (bet: PollaBetRow): IPollaTicketHolder => ({
  type: bet.polla_user_id === bet.cashier_polla_user_id ? 'CASHIER' : 'PLAYER',
  name: bet.user_name,
});

/**
 * Lo que ve un pasador o un jugador de cada jugada: quién la jugó y sus
 * aciertos, sin ids internos ni montos (los totales son solo de admin).
 */
const toPublicBet = (
  bet: PollaBetRow,
  viewer: IPollaSessionUser,
  ctx?: DeleteContext
): IPollaBetPublic => ({
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
  can_delete: canDeleteOwn(bet, viewer, ctx),
});

const forViewer = (bet: PollaBetRow, viewer: IPollaSessionUser, ctx?: DeleteContext) =>
  isPollaAdminRole(viewer.user_type) ? bet : toPublicBet(bet, viewer, ctx);

export class PollaBetRouter {
  public router: Router;

  private repository = new PollaBetRepository();

  private editionRepository = new PollaEditionRepository();

  private currentAccountRepository = new PollaCurrentAccountRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/winners', this.getWinnersHandler);
    this.router.get('/sales', this.getDailySalesHandler);
    this.router.get('/last', this.getLastHandler);
    this.router.get('/ticket/:ticketNumber', this.getByTicketHandler);
    this.router.get(
      '/check/:ticketNumber',
      requirePollaRole(...POLLA_STAFF_ROLES),
      this.checkTicketHandler
    );
    this.router.get('/', this.getAllHandler);
    this.router.get('/:id', this.getByIdHandler);
    this.router.post('/', this.createHandler);
    this.router.put('/:id', this.updateHandler);
    this.router.delete('/:id', this.deleteHandler);
  }

  private assertEditionScope = async (user: IPollaSessionUser, editionId: string) => {
    const edition = await this.editionRepository.getById(editionId);

    if (edition.polla_organization_id !== user.polla_organization_id) {
      throw new ForbiddenError('La edición pertenece a otra organización');
    }

    return edition;
  };

  /** Solo para un pasador: cierre de carga de esas ediciones y su última liquidación. */
  private buildDeleteContext = async (
    user: IPollaSessionUser,
    bets: PollaBetRow[]
  ): Promise<DeleteContext | undefined> => {
    if (user.user_type !== POLLA_USER_TYPE.CASHIER) return undefined;

    const editionIds = [...new Set(bets.map((bet) => bet.polla_edition_id))];
    const [limits, liquidatedUntil] = await Promise.all([
      this.editionRepository.getLoadLimits(editionIds),
      this.currentAccountRepository.getLastLiquidatedDate(user.polla_user_id),
    ]);

    return {
      openEditions: new Set(
        limits
          .filter((edition) => isPollaLoadOpen(edition.load_limit_date, edition.load_limit_time))
          .map((edition) => edition.polla_edition_id)
      ),
      liquidatedUntil,
    };
  };

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const isAdmin = isPollaAdminRole(user.user_type);
    const onlyMine = req.query.mine === 'true';
    // PDF de tickets: páginas de hasta 1000 de una edición. El jugador no imprime.
    const exporting = req.query.export === 'true';
    const pagination = parsePagination(
      req.query as Record<string, unknown>,
      exporting ? POLLA_EXPORT_PAGE_SIZE : undefined
    );

    const editionId = queryString(req.query.polla_edition_id) ?? undefined;

    if (exporting) {
      if (user.user_type === POLLA_USER_TYPE.PLAYER) {
        throw new ForbiddenError('Los jugadores no imprimen jugadas');
      }
      if (!editionId) throw new BadRequestError('Elegí una edición para el PDF');
    }

    if (editionId) await this.assertEditionScope(user, editionId);

    const loadRange = queryDateRange(req.query.load_from, req.query.load_to);
    const hitRange = queryDateRange(req.query.hit_from, req.query.hit_to);

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
          loadRange,
          hitRange,
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
          loadRange,
          hitRange,
          onlyWinners: req.query.winners === 'true',
        };

    // Sin acotar por edición, ticket o días, el listado sería toda la historia.
    if (
      !filters.editionId &&
      !filters.ticketNumber &&
      !filters.loadDate &&
      !filters.hitDate &&
      !loadRange &&
      !hitRange
    ) {
      throw new BadRequestError('Elegí una edición o buscá por número de ticket');
    }

    const result = await this.repository.getAll(filters, pagination, {
      sort: parseSort(req.query.sort),
      cursor: queryString(req.query.cursor),
    });

    const ctx = await this.buildDeleteContext(user, result.data);
    const data = result.data.map((bet) => forViewer(bet, user, ctx));

    res.status(200).json({ data: { bets: { ...result, data } } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const bet = await this.repository.getById(req.params.id);

    if (bet.polla_organization_id !== user.polla_organization_id) {
      throw new ForbiddenError('La jugada pertenece a otra organización');
    }

    const ctx = await this.buildDeleteContext(user, [bet]);
    res.status(200).json({ data: { bet: forViewer(bet, user, ctx) } });
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

  /**
   * "Revisar ticket": la jugada, si ganó y cuánto, de quién es (pasador, o
   * jugador y su pasador) y cómo se repartió el pozo de su edición. Todos menos
   * el jugador, siempre dentro de la propia organización.
   */
  private checkTicketHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const ticketNumber = req.params.ticketNumber.trim();

    if (!TICKET_SEARCH.test(ticketNumber)) {
      throw new BadRequestError('Número de ticket inválido');
    }

    const bet = await this.repository.getForCheck(ticketNumber, user.polla_organization_id);
    const edition = await this.editionRepository.getById(bet.polla_edition_id);
    const winners = await this.repository.getAll(
      { editionId: bet.polla_edition_id, onlyWinners: true },
      parsePagination({ page: 1, limit: 100 }),
      { sort: 'recent' }
    );

    const check: IPollaTicketCheck = {
      bet: {
        ticket_number: bet.ticket_number,
        numbers: bet.numbers,
        hit_dates: bet.hit_dates,
        hits: bet.hits,
        load_date: bet.load_date,
        winner: bet.winner,
        prize: bet.winner ? Number(bet.prize) : 0,
        hit_date: bet.hit_date,
      },
      holder: holderOf(bet),
      cashier: { name: bet.cashier_name, number: bet.cashier_number },
      edition: {
        polla_edition_id: edition.polla_edition_id,
        polla_lottery_id: edition.polla_lottery_id,
        polla_schedule_id: edition.polla_schedule_id,
        name: edition.name,
        start_date: edition.start_date,
        end_date: edition.end_date,
        load_limit_date: edition.load_limit_date,
        load_limit_time: edition.load_limit_time,
        pool_amount: Number(edition.pool_amount),
        ticket_price: Number(edition.ticket_price),
        status: edition.status,
        winner_date: edition.winner_date,
      },
      winners: winners.data.map((winner) => ({
        ticket_number: winner.ticket_number,
        holder: holderOf(winner),
        cashier_name: winner.cashier_name,
        cashier_number: winner.cashier_number,
        prize: Number(winner.prize),
      })),
    };

    res.status(200).json({ data: { check } });
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

    const isAdmin = isPollaAdminRole(user.user_type);
    const targetUserId = payload.polla_user_id ?? user.polla_user_id;

    // ADMIN+ carga a nombre de cualquier pasador o jugador de la organización
    // (la RPC valida la organización). Pasador y jugador, solo a su nombre.
    if (targetUserId !== user.polla_user_id && !isAdmin) {
      throw new ForbiddenError('Solo podés cargar jugadas a tu nombre');
    }

    const bet = await this.repository.create({
      editionId: payload.polla_edition_id,
      actorId: user.polla_user_id,
      targetUserId,
      numbers: payload.numbers,
      // Solo un admin elige el día de carga: para el resto es hoy, y el cierre
      // de la edición se mide contra la fecha y hora reales.
      date: isAdmin ? payload.date : undefined,
      force: isAdmin,
    });

    res.status(201).json({ data: { bet } });
  });

  /**
   * ADMIN y superiores pueden editar o borrar cualquier jugada, incluso pasado
   * el cierre. El pasador solo borra (no edita) las suyas o las de sus
   * jugadores; el cierre de carga y su liquidación los controla la RPC. El
   * jugador no tiene acciones.
   */
  private assertCanWrite = async (
    user: IPollaSessionUser,
    betId: string,
    action: 'edit' | 'delete'
  ) => {
    const bet = await this.repository.getById(betId);

    if (bet.polla_organization_id !== user.polla_organization_id) {
      throw new ForbiddenError('La jugada pertenece a otra organización');
    }

    if (isPollaAdminRole(user.user_type)) return bet;

    if (action === 'edit' || user.user_type !== POLLA_USER_TYPE.CASHIER) {
      throw new ForbiddenError('No podés modificar jugadas');
    }

    if (!isOwnOrImputed(bet, user)) {
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
