import { Request, Response, Router } from 'express';
import { ForbiddenError } from '@helper/errors';
import { POLLA_SUPER_ROLES } from '@helper/polla/types/user.type';
import {
  definePollaEditionDaySchema,
  newPollaResultSchema,
  updatePollaResultSchema,
  processPollaResultsSchema,
} from '@helper/polla/schemas/game.schema';
import { POLLA_API_ROLES } from '@helper/polla/config/access.config';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaResultRepository } from '../repository/polla-result.repository';
import { PollaEditionRepository } from '../../edition/repository/polla-edition.repository';
import { parsePagination } from '../../helper/pagination';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

/**
 * Los resultados valen para todos los grupos: los carga y procesa superadmin+.
 * El resto (admin de grupo incluido) los lee.
 */
export class PollaResultRouter {
  public router: Router;

  private repository = new PollaResultRepository();

  private editionRepository = new PollaEditionRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    const writeGuard = requirePollaRole(...POLLA_SUPER_ROLES);

    this.router.post('/process', writeGuard, this.processHandler);
    this.router.post('/define', writeGuard, this.defineHandler);
    // Resultados: todos menos el Súper (R11).
    const readGuard = requirePollaRole(...POLLA_API_ROLES.readResults);
    this.router.get('/', readGuard, this.getAllHandler);
    this.router.get('/:id', readGuard, this.getByIdHandler);
    this.router.post('/', writeGuard, this.createHandler);
    this.router.put('/:id', writeGuard, this.updateHandler);
    this.router.delete('/:id', writeGuard, this.deleteHandler);
  }

  private assertScope = async (req: Request, resultId: string) => {
    const { user } = getPollaSession(req);
    const result = await this.repository.getById(resultId);

    if (result.polla_organization_id !== user.polla_organization_id) {
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

    res.status(200).json({ data: { results: result } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.assertScope(req, req.params.id);
    res.status(200).json({ data: { result } });
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

  /**
   * "Definir con lo cargado": un día de la edición al que le falta un sorteo
   * (uno que no se hizo) define ganadores con los que tiene. Misma respuesta
   * que `/process`, con esa sola edición.
   */
  private defineHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = definePollaEditionDaySchema.parse(req.body);

    const edition = await this.editionRepository.getById(payload.polla_edition_id);
    if (edition.polla_organization_id !== user.polla_organization_id) {
      throw new ForbiddenError('La edición pertenece a otra organización');
    }

    const processed = await this.repository.defineEditionDay(
      payload.polla_edition_id,
      payload.date,
      user.polla_user_id
    );

    res.status(200).json({ data: { processed } });
  });
}
