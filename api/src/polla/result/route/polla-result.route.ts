import { Request, Response, Router } from 'express';
import { ForbiddenError } from '@helper/errors';
import {
  IPollaSessionUser,
  POLLA_USER_TYPE,
  isPollaAdminRole,
} from '@helper/polla/types/user.type';
import { IPollaResultEntityBack } from '@helper/polla/types/game.type';
import {
  newPollaResultSchema,
  updatePollaResultSchema,
  processPollaResultsSchema,
} from '@helper/polla/schemas/game.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaResultRepository } from '../repository/polla-result.repository';
import { parsePagination } from '../../helper/pagination';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const ADMIN_AND_UP = [
  POLLA_USER_TYPE.OWNER,
  POLLA_USER_TYPE.CAPITALIST,
  POLLA_USER_TYPE.SUPERADMIN,
  POLLA_USER_TYPE.ADMIN,
];

/**
 * La Polla se juega con las 2 últimas cifras: pasadores y jugadores ven solo
 * eso. ADMIN+ recibe las 4 porque las carga y las corrige.
 */
const forViewer = (result: IPollaResultEntityBack, viewer: IPollaSessionUser) =>
  isPollaAdminRole(viewer.user_type)
    ? result
    : { ...result, results: result.results.map((number) => number.slice(-2)) };

export class PollaResultRouter {
  public router: Router;

  private repository = new PollaResultRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    const writeGuard = requirePollaRole(...ADMIN_AND_UP);

    this.router.post('/process', writeGuard, this.processHandler);
    this.router.get('/', this.getAllHandler);
    this.router.get('/:id', this.getByIdHandler);
    this.router.post('/', writeGuard, this.createHandler);
    this.router.put('/:id', writeGuard, this.updateHandler);
    this.router.delete('/:id', writeGuard, this.deleteHandler);
  }

  private assertScope = async (req: Request, resultId: string) => {
    const { user } = getPollaSession(req);
    const result = await this.repository.getById(resultId);

    if (
      user.user_type !== POLLA_USER_TYPE.OWNER &&
      result.polla_organization_id !== user.polla_organization_id
    ) {
      throw new ForbiddenError('El resultado pertenece a otra organización');
    }

    return result;
  };

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);

    const result = await this.repository.getAll(
      {
        organizationId: resolveOptionalOrganizationId(user, req.query.polla_organization_id),
        date: typeof req.query.date === 'string' ? req.query.date : undefined,
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        lotteryId: (req.query.polla_lottery_id as string) ?? null,
        scheduleId: (req.query.polla_schedule_id as string) ?? null,
      },
      pagination
    );

    res.status(200).json({
      data: { results: { ...result, data: result.data.map((row) => forViewer(row, user)) } },
    });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const result = await this.assertScope(req, req.params.id);
    res.status(200).json({ data: { result: forViewer(result, user) } });
  });

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = newPollaResultSchema.parse(req.body);

    const created = await this.repository.create({
      ...payload,
      polla_organization_id: resolveOrganizationId(user, payload.polla_organization_id),
      loaded_by: user.polla_user_id,
    });

    res.status(201).json({ data: { result: created } });
  });

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    await this.assertScope(req, req.params.id);
    const { results } = updatePollaResultSchema.parse(req.body);
    const updated = await this.repository.update(req.params.id, results);
    res.status(200).json({ data: { result: updated } });
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    await this.assertScope(req, req.params.id);
    await this.repository.softDelete(req.params.id);
    res.status(200).json({ data: { success: true } });
  });

  /** Dispara aciertos + liquidación del día para un turno. */
  private processHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = processPollaResultsSchema.parse(req.body);

    const organizationId = resolveOrganizationId(user, payload.polla_organization_id);

    const processed = await this.repository.processDay(
      organizationId,
      payload.polla_schedule_id,
      payload.date
    );

    res.status(200).json({ data: { processed } });
  });
}
