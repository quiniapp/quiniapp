import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import {
  POLLA_ADMIN_ROLES,
  POLLA_USER_TYPE,
  POLLA_STAFF_ROLES,
  IPollaSessionUser,
  isPollaAdminRole,
  isPollaSuperRole,
} from '@helper/polla/types/user.type';
import {
  IPollaBetActions,
  IPollaBetPublic,
  IPollaDailySales,
  IPollaTicketCheck,
  IPollaTicketHolder,
  POLLA_HITS_FILTER,
} from '@helper/polla/types/game.type';
import {
  newPollaBetSchema,
  repeatPollaBetsSchema,
  updatePollaBetSchema,
} from '@helper/polla/schemas/game.schema';
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
import { parsePagination } from '../../helper/pagination';
import { pollaToday } from '../../helper/date';
import {
  assertInWritableGroup,
  resolveOptionalOrganizationId,
  resolveOrganizationId,
  writableGroupId,
} from '../../helper/scope';
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

/** `winner=true|false`: solo ganadoras o solo no ganadoras. */
const queryWinner = (value: unknown): boolean | null => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
};

/** `hits=10,9,8`: aciertos exactos de los checkboxes (10, 9, 8 y 7). */
const queryHits = (value: unknown): number[] | null => {
  const raw = queryString(value);
  if (!raw) return null;

  const hits = [...new Set(raw.split(',').map(Number))];
  if (hits.some((hit) => !(POLLA_HITS_FILTER as readonly number[]).includes(hit))) {
    throw new BadRequestError('Filtro de aciertos inválido');
  }
  return hits;
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

/** Ediciones de las jugadas listadas donde el rol todavía carga (y escribe). */
interface ActionContext {
  openEditions: Set<string>;
}

const NO_ACTIONS: IPollaBetActions = { can_edit: false, can_delete: false };

/**
 * Lo que administra cada rol ("Administrar jugadas" y su PDF de tickets): el
 * pasador, lo suyo y lo de sus jugadores; el admin, su grupo; superadmin+,
 * toda la organización.
 */
const manageScope = (user: IPollaSessionUser): Pick<PollaBetFilters, 'cashierId' | 'groupId'> => {
  if (user.user_type === POLLA_USER_TYPE.CASHIER) return { cashierId: user.polla_user_id };
  if (user.user_type === POLLA_USER_TYPE.ADMIN) return { groupId: user.polla_group_id };
  return {};
};

/**
 * Qué puede hacer el usuario con cada jugada ahora. Todos leen todo; cada rol
 * escribe en su alcance y hasta su corte (la base vuelve a controlarlo):
 * superadmin+ siempre; el admin, en su grupo hasta su corte; el pasador solo
 * borra lo suyo y lo de sus jugadores hasta el cierre de carga (da de baja lo
 * que no le pagaron, aunque ya se haya liquidado); el jugador nada.
 */
const actionsFor = (
  bet: PollaBetRow,
  viewer: IPollaSessionUser,
  ctx: ActionContext
): IPollaBetActions => {
  const alive = !bet.winner && !bet.deleted_at;
  if (!alive) return NO_ACTIONS;

  if (isPollaSuperRole(viewer.user_type)) return { can_edit: true, can_delete: true };

  const open = ctx.openEditions.has(bet.polla_edition_id);

  if (viewer.user_type === POLLA_USER_TYPE.ADMIN) {
    const inGroup = bet.polla_group_id === viewer.polla_group_id;
    return { can_edit: inGroup && open, can_delete: inGroup && open };
  }

  if (viewer.user_type === POLLA_USER_TYPE.CASHIER) {
    return { can_edit: false, can_delete: isOwnOrImputed(bet, viewer) && open };
  }

  return { can_edit: false, can_delete: false };
};

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
  actions: IPollaBetActions
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
  deducted_on: bet.deducted_on,
  is_mine: isOwnOrImputed(bet, viewer),
  is_free: bet.is_free,
  // El monto de lo propio se ve (lo cobra el pasador); el de lo ajeno es un total.
  amount: isOwnOrImputed(bet, viewer) ? Number(bet.amount) : null,
  ...actions,
});

const forViewer = (bet: PollaBetRow, viewer: IPollaSessionUser, ctx: ActionContext) => {
  const actions = actionsFor(bet, viewer, ctx);
  return isPollaAdminRole(viewer.user_type)
    ? { ...bet, ...actions }
    : toPublicBet(bet, viewer, actions);
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
    this.router.get('/sales', this.getDailySalesHandler);
    this.router.get('/last', this.getLastHandler);
    this.router.get('/mine/last-edition', this.getLastEditionHandler);
    this.router.get('/ticket/:ticketNumber', this.getByTicketHandler);
    this.router.get(
      '/check/:ticketNumber',
      requirePollaRole(...POLLA_STAFF_ROLES),
      this.checkTicketHandler
    );
    this.router.post('/repeat', this.repeatHandler);
    this.router.post(
      '/free-repeat',
      requirePollaRole(...POLLA_ADMIN_ROLES),
      this.freeRepeatHandler
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

  /** Ediciones de esas jugadas donde el rol todavía carga (para sus acciones). */
  private buildActionContext = async (
    user: IPollaSessionUser,
    bets: PollaBetRow[]
  ): Promise<ActionContext> => {
    // Superadmin+ escribe siempre y el jugador nunca: no hace falta mirar cortes.
    if (isPollaSuperRole(user.user_type) || user.user_type === POLLA_USER_TYPE.PLAYER) {
      return { openEditions: new Set() };
    }

    const editionIds = [...new Set(bets.map((bet) => bet.polla_edition_id))];
    const states = await this.editionRepository.getLoadStates(editionIds, user.user_type);

    return {
      openEditions: new Set(
        states.filter((state) => state.can_load).map((state) => state.polla_edition_id)
      ),
    };
  };

  /**
   * Jugadas de la organización (con nombres y aciertos), filtradas por grupo,
   * pasador y jugador; "solo mías" es, para el pasador, lo imputado a él.
   * Filtros de resultado: ganadoras o no (`winner`) y aciertos exactos (`hits`).
   *
   * - `view=public` ("Jugadas"): solo lectura e igual para todos los roles,
   *   toda la organización en la versión pública y sin acciones. Su PDF
   *   (`export=true&view=public`) es lo mismo, para todos menos el jugador.
   * - `view=manage` ("Administrar jugadas") y su PDF (`export=true`): solo lo
   *   que administra cada rol (`manageScope`), con sus acciones. El jugador no.
   * - Sin `view` (cuenta corriente): todos leen todo, como siempre.
   */
  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const isAdmin = isPollaAdminRole(user.user_type);
    const onlyMine = req.query.mine === 'true';
    // PDF de tickets: páginas de hasta 1000 de una edición. El jugador no imprime.
    const exporting = req.query.export === 'true';
    // El PDF de Jugadas (`view=public`) trae lo mismo que la lista.
    const publicView = req.query.view === 'public';
    const managing = !publicView && (exporting || req.query.view === 'manage');
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

    if (managing && user.user_type === POLLA_USER_TYPE.PLAYER) {
      throw new ForbiddenError('Los jugadores no administran jugadas');
    }

    if (editionId) await this.assertEditionScope(user, editionId);

    const loadRange = queryDateRange(req.query.load_from, req.query.load_to);
    const hitRange = queryDateRange(req.query.hit_from, req.query.hit_to);

    // Borradas que pasaron por la cuenta corriente: los tickets del período
    // con las que se borraron después (cuadran con el pase de jugadas) o solo
    // las que se descuentan en el período. Es parte de la liquidación: el
    // jugador no la ve, el pasador solo lo imputado a él y el admin, lo de su
    // grupo.
    const deductedRange = queryDateRange(req.query.deducted_from, req.query.deducted_to);
    const withDeducted = req.query.with_deducted === 'true';
    const deletedOnes = Boolean(deductedRange) || withDeducted;

    if (deletedOnes && user.user_type === POLLA_USER_TYPE.PLAYER) {
      throw new ForbiddenError('Los jugadores no ven jugadas borradas');
    }

    const mineFilter = (): Pick<PollaBetFilters, 'cashierId' | 'userId'> => {
      if (!onlyMine) {
        return {
          cashierId: queryString(req.query.cashier_polla_user_id),
          userId: queryString(req.query.polla_user_id),
        };
      }
      if (user.user_type === POLLA_USER_TYPE.CASHIER) {
        return { cashierId: user.polla_user_id, userId: null };
      }
      return { cashierId: null, userId: user.polla_user_id };
    };

    const filters: PollaBetFilters = {
      editionId,
      organizationId: isAdmin
        ? resolveOptionalOrganizationId(user, req.query.polla_organization_id)
        : user.polla_organization_id,
      ...mineFilter(),
      groupId: queryString(req.query.polla_group_id),
      ticketNumber: queryString(req.query.ticket_number),
      loadDate: queryDate(req.query.load_date),
      hitDate: queryDate(req.query.hit_date),
      loadRange,
      hitRange,
      deductedRange,
      withDeducted,
      onlyWinners: req.query.winners === 'true',
      winner: queryWinner(req.query.winner),
      hits: queryHits(req.query.hits),
    };

    // Las borradas son de la liquidación: cada uno ve solo lo suyo.
    if (deletedOnes && user.user_type === POLLA_USER_TYPE.CASHIER) {
      filters.cashierId = user.polla_user_id;
    }
    if (deletedOnes && user.user_type === POLLA_USER_TYPE.ADMIN) {
      filters.groupId = user.polla_group_id;
    }
    // Administrar: cada rol solo lo suyo, aunque pida otro grupo o pasador.
    if (managing) Object.assign(filters, manageScope(user));

    // Sin acotar por edición, ticket o días, el listado sería toda la historia.
    if (
      !filters.editionId &&
      !filters.ticketNumber &&
      !filters.loadDate &&
      !filters.hitDate &&
      !loadRange &&
      !hitRange &&
      !deductedRange
    ) {
      throw new BadRequestError('Elegí una edición o buscá por número de ticket');
    }

    const result = await this.repository.getAll(filters, pagination, {
      sort: parseSort(req.query.sort),
      cursor: queryString(req.query.cursor),
    });

    // La vista pública no tiene acciones: no hace falta mirar cortes.
    const ctx = publicView ? null : await this.buildActionContext(user, result.data);
    const data = result.data.map((bet) =>
      ctx ? forViewer(bet, user, ctx) : toPublicBet(bet, user, NO_ACTIONS)
    );

    // Cuántas veces se repitió sin cargo cada ticket (para quien puede hacerlo).
    const freeRepeats =
      isAdmin && managing && req.query.with_free_repeats === 'true'
        ? await this.repository.getFreeRepeatCounts(result.data.map((bet) => bet.polla_bet_id))
        : undefined;

    res.status(200).json({ data: { bets: { ...result, data, free_repeats: freeRepeats } } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const bet = await this.repository.getById(req.params.id);

    if (bet.polla_organization_id !== user.polla_organization_id) {
      throw new ForbiddenError('La jugada pertenece a otra organización');
    }

    const ctx = await this.buildActionContext(user, [bet]);
    res.status(200).json({ data: { bet: forViewer(bet, user, ctx) } });
  });

  /** Dónde busca cada rol los tickets que puede repetir. */
  private repeatScope = (user: IPollaSessionUser): PollaBetTicketScope => {
    if (isPollaSuperRole(user.user_type)) {
      return { organizationId: user.polla_organization_id };
    }
    if (user.user_type === POLLA_USER_TYPE.ADMIN) {
      return { organizationId: user.polla_organization_id, groupId: user.polla_group_id };
    }
    if (user.user_type === POLLA_USER_TYPE.CASHIER) {
      return { organizationId: user.polla_organization_id, cashierId: user.polla_user_id };
    }
    return { organizationId: user.polla_organization_id, userId: user.polla_user_id };
  };

  /**
   * Ticket a repetir por número: sus números y a nombre de quién se carga (su
   * dueño). Superadmin+ busca en la organización, el admin en su grupo, el
   * pasador en lo suyo y lo de sus jugadores, el jugador en lo suyo.
   */
  private getByTicketHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const ticketNumber = req.params.ticketNumber.trim();

    if (!TICKET_SEARCH.test(ticketNumber)) {
      throw new BadRequestError('Número de ticket inválido');
    }

    const bet = await this.repository.getByTicketNumber(ticketNumber, this.repeatScope(user));

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
        surprise_pool_amount: Number(edition.surprise_pool_amount),
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

  /** La última jugada propia (la pantalla vieja de "Repetir última jugada"). */
  private getLastHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const bet = await this.repository.getLastByUser(user.polla_user_id);
    res.status(200).json({ data: { bet } });
  });

  /** Los tickets propios de la última edición en que jugó, para repetirlos (jugador). */
  private getLastEditionHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const bets = await this.repository.getLastEditionBetsOfUser(user.polla_user_id);
    res.status(200).json({ data: { bets } });
  });

  /**
   * Repetir tickets (pagos) en una edición abierta, cada uno a nombre de su
   * dueño original: el pasador repite lo suyo y lo de sus jugadores; el
   * jugador, lo suyo; el admin, lo de su grupo; superadmin+, cualquiera. Los
   * que no se pueden repetir vuelven en `skipped` con el motivo.
   */
  private repeatHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = repeatPollaBetsSchema.parse(req.body);
    await this.assertEditionScope(user, payload.polla_edition_id);

    const result = await this.repository.repeat({
      actorId: user.polla_user_id,
      editionId: payload.polla_edition_id,
      betIds: payload.polla_bet_ids,
      free: false,
    });

    res.status(201).json({ data: { result } });
  });

  /**
   * Repetir sin cargo (admin+, en su alcance) tickets de ediciones finalizadas
   * en una edición abierta: $0 en el pase, la comisión y lo recaudado.
   */
  private freeRepeatHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = repeatPollaBetsSchema.parse(req.body);
    await this.assertEditionScope(user, payload.polla_edition_id);

    const result = await this.repository.repeat({
      actorId: user.polla_user_id,
      editionId: payload.polla_edition_id,
      betIds: payload.polla_bet_ids,
      free: true,
    });

    res.status(201).json({ data: { result } });
  });

  /**
   * Boletas vendidas en el día (sin las repetidas sin cargo). Superadmin+ ve el
   * total de la organización y el desglose por grupo; el admin, su grupo; el
   * pasador, solo lo imputado a él.
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
      isCashier ? user.polla_user_id : null,
      writableGroupId(user)
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

    const ctx: ActionContext = { openEditions: new Set() };
    const data = result.data.map((bet) => forViewer(bet, user, ctx));

    res.status(200).json({ data: { winners: { ...result, data } } });
  });

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = newPollaBetSchema.parse(req.body);

    await this.assertEditionScope(user, payload.polla_edition_id);

    const isAdmin = isPollaAdminRole(user.user_type);
    const targetUserId = payload.polla_user_id ?? user.polla_user_id;

    // ADMIN+ carga a nombre de un pasador o jugador (el admin, solo de su
    // grupo; la RPC lo valida). Pasador y jugador, solo a su nombre.
    if (targetUserId !== user.polla_user_id && !isAdmin) {
      throw new ForbiddenError('Solo podés cargar jugadas a tu nombre');
    }

    const bet = await this.repository.create({
      editionId: payload.polla_edition_id,
      actorId: user.polla_user_id,
      targetUserId,
      numbers: payload.numbers,
      // Solo superadmin+ elige el día de carga: para el resto es hoy, y el
      // corte de cada rol lo controla la RPC.
      date: isPollaSuperRole(user.user_type) ? payload.date : undefined,
    });

    res.status(201).json({ data: { bet } });
  });

  /**
   * Superadmin+ edita o borra cualquier jugada no ganadora, en cualquier
   * momento. El admin, las de su grupo hasta su corte. El pasador solo borra
   * (no edita) las suyas o las de sus jugadores, hasta el cierre de carga; si
   * ya se liquidaron, la baja se descuenta del pase el día que se borra. El
   * jugador no tiene acciones. La RPC vuelve a controlar todo.
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

    if (isPollaAdminRole(user.user_type)) {
      assertInWritableGroup(user, bet.polla_group_id);
      return bet;
    }

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

    const bet = await this.repository.updateNumbers(req.params.id, numbers, user.polla_user_id);

    res.status(200).json({ data: { bet } });
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.assertCanWrite(user, req.params.id, 'delete');

    const { deducted_on } = await this.repository.remove(req.params.id, user.polla_user_id);

    res.status(200).json({ data: { success: true, deducted_on } });
  });
}
