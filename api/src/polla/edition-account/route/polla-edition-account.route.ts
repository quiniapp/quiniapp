import { Request, Response, Router } from 'express';
import { BadRequestError, NotFoundError } from '@helper/errors';
import { POLLA_ACCOUNT_ROLES, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { POLLA_GROUP_REPORT_MAX_DAYS } from '@helper/polla/config/session.config';
import {
  IPollaEditionAccountListItem,
  IPollaEditionEntityBack,
  IPollaEditionEntityFront,
  IPollaGroupEditionLiquidation,
  IPollaUserEditionAccount,
  POLLA_ACCOUNT_MOVEMENT_TYPE,
} from '@helper/polla/types/game.type';
import {
  generateEditionLiquidationSchema,
  liquidateEditionAccountsSchema,
  liquidatePollaGroupEditionSchema,
  liquidatePollaGroupEditionsSchema,
  pollaAccountMovementSchema,
  pollaAccountMovementUpdateSchema,
  setEditionLiquidatedSchema,
  updatePollaGroupMovementSchema,
} from '@helper/polla/schemas/game.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaEditionAccountRepository } from '../repository/polla-edition-account.repository';
import { PollaEditionRepository } from '../../edition/repository/polla-edition.repository';
import { buildPaginated, parsePagination } from '../../helper/pagination';
import { resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tope de ediciones por consulta de totales (la web parte el pedido en tandas de este tamaño). */
const MAX_TOTALS_EDITIONS = 60;

/** Ediciones por consulta al traerlas por id. */
const EDITIONS_PER_FETCH = 100;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const queryString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const queryUuid = (value: unknown, label: string): string | null => {
  const raw = queryString(value);
  if (raw && !UUID.test(raw)) throw new BadRequestError(`${label} inválido`);
  return raw;
};

const queryDate = (value: unknown, label: string): string | null => {
  const raw = queryString(value);
  if (raw && !ISO_DATE.test(raw)) throw new BadRequestError(`${label} inválido`);
  return raw;
};

const paramUuid = (value: string, label: string): string => {
  if (!UUID.test(value)) throw new BadRequestError(`${label} inválido`);
  return value;
};

/** Argentina no tiene horario de verano: los días de liquidación van en UTC-3. */
const AR_OFFSET = '-03:00';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Hoy en Argentina (`YYYY-MM-DD`), como `polla_today()`. */
const argentinaToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

/**
 * Rango del parte diario de grupos: `from` y `to` juntos, Desde ≤ Hasta ≤ hoy y
 * hasta `POLLA_GROUP_REPORT_MAX_DAYS` días. Devuelve los bordes semiabiertos en
 * hora de Argentina: `[from 00:00, to + 1 00:00)`.
 */
const queryLiquidatedRange = (fromValue: unknown, toValue: unknown) => {
  const from = queryDate(fromValue, 'from');
  const to = queryDate(toValue, 'to');
  if (!from && !to) return null;
  if (!from || !to) throw new BadRequestError('Faltan las fechas desde y hasta');
  if (from > to) {
    throw new BadRequestError('La fecha desde tiene que ser anterior a la fecha hasta');
  }
  if (to > argentinaToday()) {
    throw new BadRequestError('La fecha hasta no puede ser posterior a hoy');
  }
  const start = Date.parse(`${from}T00:00:00${AR_OFFSET}`);
  const end = Date.parse(`${to}T00:00:00${AR_OFFSET}`) + DAY_MS;
  if ((end - start) / DAY_MS > POLLA_GROUP_REPORT_MAX_DAYS) {
    throw new BadRequestError(`El rango no puede pasar de ${POLLA_GROUP_REPORT_MAX_DAYS} días`);
  }
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
};

/** `polla_edition_ids=a,b,c`: lista de UUID sin repetir, de hasta 60. */
const queryEditionIds = (value: unknown): string[] => {
  const raw = queryString(value);
  if (!raw) throw new BadRequestError('Falta polla_edition_ids');

  const ids = [...new Set(raw.split(',').map((id) => id.trim()))];
  if (ids.length > MAX_TOTALS_EDITIONS) {
    throw new BadRequestError(`Se pueden pedir hasta ${MAX_TOTALS_EDITIONS} ediciones`);
  }
  if (ids.some((id) => !UUID.test(id))) throw new BadRequestError('polla_edition_ids inválido');
  return ids;
};

/** La edición con la forma que ven los demás endpoints de ediciones. */
const toFrontEdition = (
  edition: IPollaEditionEntityBack,
  showTotals: boolean
): IPollaEditionEntityFront => {
  const { deleted_at: _deleted, bets_count: count, collected_amount: collected, ...rest } = edition;
  void _deleted;
  return (
    showTotals ? { ...rest, bets_count: count, collected_amount: collected } : rest
  ) as IPollaEditionEntityFront;
};

/**
 * Cuenta corriente por edición. Ven y liquidan dueño, capitalista y
 * superadmin (`POLLA_ACCOUNT_ROLES`); el pasador solo lee lo suyo (la ruta le
 * fuerza su propio `polla_user_id`). El admin de grupo solo entra a
 * `/group_mine` (las liquidaciones de su grupo, con el grupo y la organización
 * de la sesión); el resto no entra.
 * Las rutas estáticas van antes de `/:editionId`.
 */
export class PollaEditionAccountRouter {
  public router: Router;

  private repository = new PollaEditionAccountRepository();

  private editionRepository = new PollaEditionRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    const accountGuard = requirePollaRole(...POLLA_ACCOUNT_ROLES);
    const readGuard = requirePollaRole(...POLLA_ACCOUNT_ROLES, POLLA_USER_TYPE.CASHIER);
    const cashierGuard = requirePollaRole(POLLA_USER_TYPE.CASHIER);
    const adminGuard = requirePollaRole(POLLA_USER_TYPE.ADMIN);

    this.router.get('/', accountGuard, this.listHandler);
    this.router.get('/mine', cashierGuard, this.mineHandler);
    this.router.get('/group_mine', adminGuard, this.groupMineHandler);
    this.router.get('/totals', accountGuard, this.totalsHandler);
    this.router.get('/group_accounts', accountGuard, this.groupAccountsHandler);
    this.router.put('/movements/:id', accountGuard, this.updateMovementHandler);
    this.router.delete('/movements/:id', accountGuard, this.deleteMovementHandler);
    this.router.put('/group_movements/:id', accountGuard, this.updateGroupMovementHandler);
    this.router.delete('/group_movements/:id', accountGuard, this.deleteGroupMovementHandler);

    this.router.get('/:editionId/accounts', readGuard, this.accountsHandler);
    this.router.post('/:editionId/liquidate', accountGuard, this.liquidateHandler);
    this.router.post('/:editionId/generate', accountGuard, this.generateHandler);
    this.router.put('/:editionId/liquidated', accountGuard, this.setLiquidatedHandler);
    this.router.get('/:editionId/movements', readGuard, this.movementsHandler);
    this.router.post('/:editionId/movements', accountGuard, this.createMovementHandler);
    this.router.get('/:editionId/group_previews', accountGuard, this.groupPreviewsHandler);
    this.router.get('/:editionId/group_movements', accountGuard, this.groupMovementsHandler);
    this.router.post('/:editionId/group_liquidate', accountGuard, this.groupLiquidateHandler);
    this.router.post(
      '/:editionId/group_liquidate_many',
      accountGuard,
      this.groupLiquidateManyHandler
    );
  }

  /** Ediciones por `polla_edition_id`, tal como las ve el front. */
  private loadEditions = async (organizationId: string, ids: string[], showTotals: boolean) => {
    const byId = new Map<string, IPollaEditionEntityFront>();

    // De a tandas: el filtro por ids viaja en la URL de PostgREST.
    for (let start = 0; start < ids.length; start += EDITIONS_PER_FETCH) {
      const chunk = ids.slice(start, start + EDITIONS_PER_FETCH);
      const page = await this.editionRepository.getAll(
        { organizationId, ids: chunk },
        { page: 1, limit: chunk.length, from: 0, to: chunk.length - 1, withCount: false }
      );
      for (const edition of page.data as IPollaEditionEntityBack[]) {
        byId.set(edition.polla_edition_id, toFrontEdition(edition, showTotals));
      }
    }
    return byId;
  };

  /** Para el pasador, siempre el suyo; para el staff, el que pida. */
  private scopedUserId = (req: Request): string | null => {
    const { user } = getPollaSession(req);
    return user.user_type === POLLA_USER_TYPE.CASHIER
      ? user.polla_user_id
      : queryUuid(req.query.polla_user_id, 'polla_user_id');
  };

  /**
   * El pasador solo ve las ediciones donde lo liquidaron (no las que están en
   * carga ni las que no se liquidaron): si no, 404 como si no existiera.
   */
  private assertCashierLiquidated = async (
    req: Request,
    organizationId: string,
    editionId: string
  ) => {
    const { user } = getPollaSession(req);
    if (user.user_type !== POLLA_USER_TYPE.CASHIER) return;

    if (!(await this.repository.hasLiquidation(organizationId, editionId, user.polla_user_id))) {
      throw new NotFoundError('Edición');
    }
  };

  /**
   * Ediciones con la carga cerrada o que ya empezaron, paginadas; cada ítem trae
   * `load_open` (pasa tal cual desde la base). `status=pending` las que faltan
   * marcar; `status=done`, las liquidaciones realizadas; sin `status`, todas.
   * `from`/`to` acotan el inicio. `counts=false` no calcula la cuenta (para los
   * selectores de edición).
   */
  private listHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const organizationId = resolveOrganizationId(user, req.query.polla_organization_id);
    const pagination = parsePagination(req.query as Record<string, unknown>);

    const status = queryString(req.query.status);
    if (status && status !== 'pending' && status !== 'done') {
      throw new BadRequestError('status inválido');
    }

    const rows = await this.repository.list({
      organizationId,
      liquidated: status ? status === 'done' : null,
      from: queryDate(req.query.from, 'from'),
      to: queryDate(req.query.to, 'to'),
      withCounts: req.query.counts !== 'false',
      limit: pagination.limit,
      offset: pagination.from,
    });
    const editions = await this.loadEditions(
      organizationId,
      rows.map((row) => row.polla_edition_id),
      true
    );

    const data: IPollaEditionAccountListItem[] = [];
    for (const { polla_edition_id: id, total_count: _total, ...row } of rows) {
      void _total;
      const edition = editions.get(id);
      if (edition) data.push({ ...row, edition });
    }

    // Una página más allá del final viene vacía: el total solo se sabe con filas.
    const totalCount = rows.length > 0 ? Number(rows[0].total_count) : pagination.from;
    res.status(200).json({ data: { editions: buildPaginated(data, pagination, totalCount) } });
  });

  private mineHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const organizationId = user.polla_organization_id;

    const rows = await this.repository.userAccounts(organizationId, user.polla_user_id);
    const editions = await this.loadEditions(
      organizationId,
      rows.map((row) => row.polla_edition_id),
      false
    );

    const data: IPollaUserEditionAccount[] = [];
    for (const { polla_edition_id: id, account } of rows) {
      const edition = editions.get(id);
      if (edition) data.push({ edition, account });
    }

    res.status(200).json({ data: { editions: data } });
  });

  /**
   * Las liquidaciones del grupo del admin, de la más nueva a la más vieja. El
   * grupo y la organización salen solo de la sesión: nada del query.
   */
  private groupMineHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const organizationId = user.polla_organization_id;
    const groupId = user.polla_group_id;
    if (!groupId) throw new NotFoundError('Grupo');

    const accounts = await this.repository.groupAccountsOfGroup({ organizationId, groupId });
    const editions = await this.loadEditions(
      organizationId,
      accounts.map((account) => account.polla_edition_id),
      false
    );

    const liquidations: IPollaGroupEditionLiquidation[] = [];
    for (const account of accounts) {
      const edition = editions.get(account.polla_edition_id);
      if (edition) liquidations.push({ edition, account });
    }
    liquidations.sort((a, b) => b.edition.start_date.localeCompare(a.edition.start_date));

    res.status(200).json({ data: { liquidations } });
  });

  private totalsHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);

    const totals = await this.repository.totals({
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      editionIds: queryEditionIds(req.query.polla_edition_ids),
      groupId: queryUuid(req.query.polla_group_id, 'polla_group_id'),
    });

    res.status(200).json({ data: { totals } });
  });

  private groupAccountsHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);

    const groupAccounts = await this.repository.groupAccounts({
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      editionId: queryUuid(req.query.polla_edition_id, 'polla_edition_id'),
      groupId: queryUuid(req.query.polla_group_id, 'polla_group_id'),
      // Parte diario de grupos por rango: por fecha de liquidación.
      liquidated: queryLiquidatedRange(req.query.from, req.query.to),
    });

    res.status(200).json({ data: { group_accounts: groupAccounts } });
  });

  private updateMovementHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const organizationId = resolveOrganizationId(user, req.query.polla_organization_id);
    const id = paramUuid(req.params.id, 'Movimiento');
    const props = pollaAccountMovementUpdateSchema.parse(req.body);

    // El esquema no conoce el tipo: cobros y pagos siguen siendo positivos.
    const existing = await this.repository.getMovement(id, organizationId);
    if (
      props.amount !== undefined &&
      existing.type !== POLLA_ACCOUNT_MOVEMENT_TYPE.CLAIM &&
      props.amount <= 0
    ) {
      throw new BadRequestError('El cobro y el pago tienen que ser mayores a 0');
    }

    const movement = await this.repository.updateMovement(
      id,
      organizationId,
      props,
      user.polla_user_id
    );

    res.status(200).json({ data: { movement } });
  });

  private deleteMovementHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);

    await this.repository.deleteMovement(
      paramUuid(req.params.id, 'Movimiento'),
      resolveOrganizationId(user, req.query.polla_organization_id),
      user.polla_user_id
    );

    res.status(200).json({ data: { success: true } });
  });

  private accountsHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const organizationId = resolveOrganizationId(user, req.query.polla_organization_id);
    const editionId = paramUuid(req.params.editionId, 'Edición');
    await this.assertCashierLiquidated(req, organizationId, editionId);

    const accounts = await this.repository.accounts({
      organizationId,
      editionId,
      groupId: queryUuid(req.query.polla_group_id, 'polla_group_id'),
      userId: this.scopedUserId(req),
    });

    res.status(200).json({ data: { accounts } });
  });

  private liquidateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = liquidateEditionAccountsSchema.parse(req.body);

    const result = await this.repository.liquidate({
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      editionId: paramUuid(req.params.editionId, 'Edición'),
      userIds: payload.polla_user_ids,
      actorId: user.polla_user_id,
      ticketSource: payload.ticket_source,
    });

    res.status(200).json({ data: { result } });
  });

  /**
   * "Generar liquidación": los pasadores tildados con lo que se suma hoy en
   * reclamos, cobros y pagos. Carga los movimientos, liquida y marca la
   * edición, todo junto (ver `polla_generate_edition_liquidation`).
   */
  private generateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = generateEditionLiquidationSchema.parse(req.body);

    const result = await this.repository.generate({
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      editionId: paramUuid(req.params.editionId, 'Edición'),
      actorId: user.polla_user_id,
      entries: payload.entries,
      ticketSource: payload.ticket_source,
    });

    res.status(200).json({ data: { result } });
  });

  private setLiquidatedHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = setEditionLiquidatedSchema.parse(req.body);

    const edition = await this.repository.setLiquidated({
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      editionId: paramUuid(req.params.editionId, 'Edición'),
      actorId: user.polla_user_id,
      liquidated: payload.liquidated,
    });

    res.status(200).json({ data: { edition } });
  });

  private movementsHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const organizationId = resolveOrganizationId(user, req.query.polla_organization_id);
    const editionId = paramUuid(req.params.editionId, 'Edición');
    await this.assertCashierLiquidated(req, organizationId, editionId);

    const movements = await this.repository.movements({
      organizationId,
      editionId,
      userId: this.scopedUserId(req),
    });

    res.status(200).json({ data: { movements } });
  });

  private createMovementHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = pollaAccountMovementSchema.parse(req.body);

    const movement = await this.repository.createMovement({
      ...payload,
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      editionId: paramUuid(req.params.editionId, 'Edición'),
      createdBy: user.polla_user_id,
    });

    res.status(201).json({ data: { movement } });
  });

  /** Lo que se liquidaría a cada grupo de la organización en la edición. */
  private groupPreviewsHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const organizationId = resolveOrganizationId(user, req.query.polla_organization_id);
    const editionId = paramUuid(req.params.editionId, 'Edición');

    // Todos los grupos en una consulta (la cuenta de la edición se calcula una vez).
    const previews = await this.repository.groupPreviews(organizationId, editionId);

    res.status(200).json({ data: { previews } });
  });

  private groupLiquidateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = liquidatePollaGroupEditionSchema.parse(req.body);

    const groupAccount = await this.repository.liquidateGroup({
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      groupId: payload.polla_group_id,
      editionId: paramUuid(req.params.editionId, 'Edición'),
      // Si el admin tiene su % configurado, la base usa ese.
      percentage: payload.admin_percentage ?? null,
      // Sin ajustes ni pagado: el total del admin es el 100% de la comisión.
      adjustments: 0,
      paid: 0,
      collection: payload.collection ?? 0,
      payment: payload.payment ?? 0,
      actorId: user.polla_user_id,
    });

    res.status(200).json({ data: { group_account: groupAccount } });
  });

  /** Cobros y pagos vigentes de un grupo en la edición. */
  private groupMovementsHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);

    const groupId = queryUuid(req.query.polla_group_id, 'polla_group_id');
    if (!groupId) throw new BadRequestError('Falta polla_group_id');

    const movements = await this.repository.groupMovements({
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      groupId,
      editionId: paramUuid(req.params.editionId, 'Edición'),
    });

    res.status(200).json({ data: { movements } });
  });

  private updateGroupMovementHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const { amount } = updatePollaGroupMovementSchema.parse(req.body);

    const movement = await this.repository.updateGroupMovement(
      paramUuid(req.params.id, 'Movimiento'),
      resolveOrganizationId(user, req.query.polla_organization_id),
      amount,
      user.polla_user_id
    );

    res.status(200).json({ data: { movement } });
  });

  private deleteGroupMovementHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);

    await this.repository.deleteGroupMovement(
      paramUuid(req.params.id, 'Movimiento'),
      resolveOrganizationId(user, req.query.polla_organization_id),
      user.polla_user_id
    );

    res.status(200).json({ data: { success: true } });
  });

  /** Varios grupos juntos ("Liquidar seleccionados"): todo o nada. */
  private groupLiquidateManyHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const { groups } = liquidatePollaGroupEditionsSchema.parse(req.body);

    const groupAccounts = await this.repository.liquidateGroups({
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      editionId: paramUuid(req.params.editionId, 'Edición'),
      groups,
      actorId: user.polla_user_id,
    });

    res.status(200).json({ data: { group_accounts: groupAccounts } });
  });
}
