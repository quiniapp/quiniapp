import { Request, Response, Router } from 'express';
import { ForbiddenError } from '@helper/errors';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { POLLA_EDITION_STATUS } from '@helper/polla/types/game.type';
import { newPollaEditionSchema, updatePollaEditionSchema } from '@helper/polla/schemas/game.schema';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaEditionRepository } from '../repository/polla-edition.repository';
import { parsePagination } from '../../helper/pagination';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const ADMIN_AND_UP = [
  POLLA_USER_TYPE.OWNER,
  POLLA_USER_TYPE.CAPITALIST,
  POLLA_USER_TYPE.SUPERADMIN,
  POLLA_USER_TYPE.ADMIN,
];

export class PollaEditionRouter {
  public router: Router;

  private repository = new PollaEditionRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    const writeGuard = requirePollaRole(...ADMIN_AND_UP);

    this.router.get('/', this.getAllHandler);
    this.router.get('/:id', this.getByIdHandler);
    this.router.post('/', writeGuard, this.createHandler);
    this.router.put('/:id', writeGuard, this.updateHandler);
    this.router.delete('/:id', writeGuard, this.deleteHandler);
  }

  private assertScope = async (req: Request, editionId: string) => {
    const { user } = getPollaSession(req);
    const edition = await this.repository.getById(editionId);

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

    const result = await this.repository.getAll(
      {
        organizationId: resolveOptionalOrganizationId(user, req.query.polla_organization_id),
        status: req.query.status as POLLA_EDITION_STATUS | undefined,
        playingOn: typeof req.query.playing_on === 'string' ? req.query.playing_on : undefined,
        loadableOn: typeof req.query.loadable_on === 'string' ? req.query.loadable_on : undefined,
      },
      pagination
    );

    res.status(200).json({ data: { editions: result } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const edition = await this.assertScope(req, req.params.id);
    res.status(200).json({ data: { edition } });
  });

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const payload = newPollaEditionSchema.parse(req.body);

    const created = await this.repository.create({
      ...payload,
      polla_organization_id: resolveOrganizationId(user, payload.polla_organization_id),
    });

    res.status(201).json({ data: { edition: created } });
  });

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    await this.assertScope(req, req.params.id);
    const payload = updatePollaEditionSchema.parse(req.body);
    const updated = await this.repository.update(req.params.id, payload);
    res.status(200).json({ data: { edition: updated } });
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    await this.assertScope(req, req.params.id);
    await this.repository.softDelete(req.params.id);
    res.status(200).json({ data: { success: true } });
  });
}
