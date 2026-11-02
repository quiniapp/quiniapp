import { Request, Response, Router } from 'express';
import { BadRequestError } from '@helper/errors';
import { POLLA_SUPER_ROLES, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { IPollaGroupEntityBack } from '@helper/polla/types/catalog.type';
import { liquidatePollaGroupSchema } from '@helper/polla/schemas/game.schema';
import { IPollaGroupAccountPreview } from '@helper/polla/types/game.type';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaCatalogRepository } from '../../catalog/repository/polla-catalog.repository';
import { PollaGroupAccountRepository } from '../repository/polla-group-account.repository';
import { parsePagination } from '../../helper/pagination';
import { assertInWritableGroup, writableGroupId } from '../../helper/scope';
import { pollaToday } from '../../helper/date';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const queryString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const queryDate = (value: unknown, fallback?: string): string | null => {
  const date = queryString(value) ?? fallback ?? null;
  if (date && !ISO_DATE.test(date)) throw new BadRequestError('Fecha inválida (YYYY-MM-DD)');
  return date;
};

/**
 * Cuenta corriente de los grupos. Superadmin+ ve y liquida todos; el admin ve
 * solo la de su grupo (lectura). Pasador y jugador no tienen acceso.
 */
export class PollaGroupAccountRouter {
  public router: Router;

  private repository = new PollaGroupAccountRepository();

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
    const readGuard = requirePollaRole(...POLLA_SUPER_ROLES, POLLA_USER_TYPE.ADMIN);
    const writeGuard = requirePollaRole(...POLLA_SUPER_ROLES);

    this.router.get('/', readGuard, this.getAllHandler);
    this.router.get('/previews', readGuard, this.getPreviewsHandler);
    this.router.post('/liquidate', writeGuard, this.liquidateHandler);
  }

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);

    const result = await this.repository.getAll(
      {
        organizationId: user.polla_organization_id,
        groupId: writableGroupId(user) ?? queryString(req.query.polla_group_id),
        from: queryDate(req.query.from),
        to: queryDate(req.query.to),
      },
      pagination
    );

    res.status(200).json({ data: { group_accounts: result } });
  });

  /**
   * Lo que se liquidaría a cada grupo a la fecha, con los pasadores que faltan
   * liquidar. El admin recibe solo el de su grupo.
   */
  private getPreviewsHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const date = queryDate(req.query.date, pollaToday())!;
    const organizationId = user.polla_organization_id;

    const ownGroup = writableGroupId(user);
    const groupIds = ownGroup
      ? [ownGroup]
      : (
          (
            await this.groupRepository.getAll(
              { organizationId },
              parsePagination({ page: 1, limit: 100 })
            )
          ).data as IPollaGroupEntityBack[]
        ).map((group) => group.polla_group_id);

    const [previews, sameDay] = await Promise.all([
      Promise.all(
        groupIds.map((groupId) => this.repository.preview(organizationId, groupId, date))
      ),
      // Liquidaciones de esa misma fecha: liquidar de nuevo las rehace.
      this.repository.getAll(
        { organizationId, groupId: ownGroup, from: date, to: date },
        parsePagination({ page: 1, limit: 100 })
      ),
    ]);

    const liquidated = new Set(sameDay.data.map((account) => account.polla_group_id));
    const data: IPollaGroupAccountPreview[] = previews.map((preview) => ({
      ...preview,
      liquidated_on_date: liquidated.has(preview.polla_group_id),
    }));

    res.status(200).json({ data: { previews: data } });
  });

  private liquidateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = liquidatePollaGroupSchema.parse(req.body);
    assertInWritableGroup(user, payload.polla_group_id);

    const account = await this.repository.liquidate({
      organizationId: user.polla_organization_id,
      groupId: payload.polla_group_id,
      date: payload.date,
      percentage: payload.admin_percentage,
      adjustments: payload.adjustments ?? 0,
      paid: payload.paid ?? 0,
      actorId: user.polla_user_id,
    });

    res.status(200).json({ data: { group_account: account } });
  });
}
