import { Request, Response, Router } from 'express';
import { BadRequestError, NotFoundError } from '@helper/errors';
import { POLLA_ACCOUNT_ROLES, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaGroupAccountRepository } from '../repository/polla-group-account.repository';
import { parsePagination } from '../../helper/pagination';
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
 * Historial de las liquidaciones de grupos por fecha (solo consulta; la cuenta por
 * edición vive en `/edition_account`). `GET /` es de dueño, capitalista y
 * superadmin (`POLLA_ACCOUNT_ROLES`). `GET /mine` es del admin de grupo y trae
 * solo las de su grupo (el de la sesión, nunca el del query). El Super
 * (ASSISTANT), el pasador y el jugador no tienen acceso.
 */
export class PollaGroupAccountRouter {
  public router: Router;

  private repository = new PollaGroupAccountRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/', requirePollaRole(...POLLA_ACCOUNT_ROLES), this.getAllHandler);
    this.router.get('/mine', requirePollaRole(POLLA_USER_TYPE.ADMIN), this.getMineHandler);
  }

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);

    const result = await this.repository.getAll(
      {
        organizationId: user.polla_organization_id,
        groupId: queryString(req.query.polla_group_id),
        from: queryDate(req.query.from),
        to: queryDate(req.query.to),
      },
      pagination
    );

    res.status(200).json({ data: { group_accounts: result } });
  });

  /** Las liquidaciones del grupo del admin: grupo y organización solo de la sesión. */
  private getMineHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    if (!user.polla_group_id) throw new NotFoundError('Grupo');
    // OFFSET acotado: una fila por liquidación diaria o de período de un solo
    // grupo (misma paginación que `GET /`).
    const pagination = parsePagination(req.query as Record<string, unknown>);

    const result = await this.repository.getAll(
      {
        organizationId: user.polla_organization_id,
        groupId: user.polla_group_id,
        from: queryDate(req.query.from),
        to: queryDate(req.query.to),
      },
      pagination
    );

    res.status(200).json({ data: { group_accounts: result } });
  });
}
