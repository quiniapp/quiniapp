import { Request, Response, Router } from 'express';
import { BadRequestError, NotFoundError } from '@helper/errors';
import { POLLA_ACCOUNT_ROLES, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import {
  IPollaEditionAccountListItem,
  IPollaEditionEntityBack,
  IPollaEditionEntityFront,
  IPollaGroupEditionAccountPreview,
  IPollaUserEditionAccount,
  POLLA_ACCOUNT_MOVEMENT_TYPE,
} from '@helper/polla/types/game.type';
import { IPollaGroupEntityBack } from '@helper/polla/types/catalog.type';
import {
  liquidateEditionAccountsSchema,
  liquidatePollaGroupEditionSchema,
  pollaAccountMovementSchema,
  pollaAccountMovementUpdateSchema,
  setEditionLiquidatedSchema,
} from '@helper/polla/schemas/game.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaEditionAccountRepository } from '../repository/polla-edition-account.repository';
import { PollaEditionRepository } from '../../edition/repository/polla-edition.repository';
import { PollaCatalogRepository } from '../../catalog/repository/polla-catalog.repository';
import { parsePagination } from '../../helper/pagination';
import { resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tope de ediciones por consulta de totales. */
const MAX_TOTALS_EDITIONS = 60;

const queryString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const queryUuid = (value: unknown, label: string): string | null => {
  const raw = queryString(value);
  if (raw && !UUID.test(raw)) throw new BadRequestError(`${label} inválido`);
  return raw;
};

const paramUuid = (value: string, label: string): string => {
  if (!UUID.test(value)) throw new BadRequestError(`${label} inválido`);
  return value;
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
 * fuerza su propio `polla_user_id`). El admin de grupo y el resto no entran.
 * Las rutas estáticas van antes de `/:editionId`.
 */
export class PollaEditionAccountRouter {
  public router: Router;

  private repository = new PollaEditionAccountRepository();

  private editionRepository = new PollaEditionRepository();

  private groupRepository = new PollaCatalogRepository({
    table: 'polla_groups',
    idColumn: 'polla_group_id',
    orgScoped: true,
    orderBy: { column: 'name', ascending: true },
  });

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    const accountGuard = requirePollaRole(...POLLA_ACCOUNT_ROLES);
    const readGuard = requirePollaRole(...POLLA_ACCOUNT_ROLES, POLLA_USER_TYPE.CASHIER);
    const cashierGuard = requirePollaRole(POLLA_USER_TYPE.CASHIER);

    this.router.get('/', accountGuard, this.listHandler);
    this.router.get('/mine', cashierGuard, this.mineHandler);
    this.router.get('/totals', accountGuard, this.totalsHandler);
    this.router.get('/group_accounts', accountGuard, this.groupAccountsHandler);
    this.router.put('/movements/:id', accountGuard, this.updateMovementHandler);
    this.router.delete('/movements/:id', accountGuard, this.deleteMovementHandler);

    this.router.get('/:editionId/accounts', readGuard, this.accountsHandler);
    this.router.post('/:editionId/liquidate', accountGuard, this.liquidateHandler);
    this.router.put('/:editionId/liquidated', accountGuard, this.setLiquidatedHandler);
    this.router.get('/:editionId/movements', readGuard, this.movementsHandler);
    this.router.post('/:editionId/movements', accountGuard, this.createMovementHandler);
    this.router.get('/:editionId/group_previews', accountGuard, this.groupPreviewsHandler);
    this.router.post('/:editionId/group_liquidate', accountGuard, this.groupLiquidateHandler);
  }

  /** Ediciones por `polla_edition_id`, tal como las ve el front. */
  private loadEditions = async (organizationId: string, ids: string[], showTotals: boolean) => {
    const byId = new Map<string, IPollaEditionEntityFront>();
    if (ids.length === 0) return byId;

    const page = await this.editionRepository.getAll(
      { organizationId, ids },
      { page: 1, limit: ids.length, from: 0, to: ids.length - 1, withCount: false }
    );
    for (const edition of page.data as IPollaEditionEntityBack[]) {
      byId.set(edition.polla_edition_id, toFrontEdition(edition, showTotals));
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

  private listHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const organizationId = resolveOrganizationId(user, req.query.polla_organization_id);

    const rows = await this.repository.list(organizationId);
    const editions = await this.loadEditions(
      organizationId,
      rows.map((row) => row.polla_edition_id),
      true
    );

    const data: IPollaEditionAccountListItem[] = [];
    for (const { polla_edition_id: id, ...row } of rows) {
      const edition = editions.get(id);
      if (edition) data.push({ ...row, edition });
    }

    res.status(200).json({ data: { editions: data } });
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

    const groups = await this.groupRepository.getAll(
      { organizationId },
      parsePagination({ page: 1, limit: 100 })
    );
    const groupIds = (groups.data as IPollaGroupEntityBack[]).map((group) => group.polla_group_id);

    const previews: IPollaGroupEditionAccountPreview[] = await Promise.all(
      groupIds.map((groupId) => this.repository.groupPreview(organizationId, groupId, editionId))
    );

    res.status(200).json({ data: { previews } });
  });

  private groupLiquidateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = liquidatePollaGroupEditionSchema.parse(req.body);

    const groupAccount = await this.repository.liquidateGroup({
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      groupId: payload.polla_group_id,
      editionId: paramUuid(req.params.editionId, 'Edición'),
      percentage: payload.admin_percentage,
      adjustments: payload.adjustments ?? 0,
      paid: payload.paid ?? 0,
      actorId: user.polla_user_id,
    });

    res.status(200).json({ data: { group_account: groupAccount } });
  });
}
