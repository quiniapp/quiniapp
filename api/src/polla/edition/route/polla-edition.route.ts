import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import { POLLA_USER_TYPE, isPollaAdminRole } from '@helper/polla/types/user.type';
import { IPollaEditionEntityBack, POLLA_EDITION_STATUS } from '@helper/polla/types/game.type';
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

/** Recaudado y cantidad de jugadas son totales: solo los ve un admin. */
const withoutTotals = (edition: IPollaEditionEntityBack) => {
  const { bets_count: _count, collected_amount: _collected, ...rest } = edition;
  void _count;
  void _collected;
  return rest;
};

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

    const data = isPollaAdminRole(user.user_type) ? result.data : result.data.map(withoutTotals);

    res.status(200).json({ data: { editions: { ...result, data } } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const edition = await this.assertScope(req, req.params.id);

    res.status(200).json({
      data: { edition: isPollaAdminRole(user.user_type) ? edition : withoutTotals(edition) },
    });
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
    const edition = await this.assertScope(req, req.params.id);
    const payload = updatePollaEditionSchema.parse(req.body);

    // Cada jugada guarda el precio con el que se cargó y la cuenta corriente
    // suma ese monto: cambiar el precio con jugadas cargadas desfasa el pase.
    if (
      payload.ticket_price !== undefined &&
      Number(payload.ticket_price) !== Number(edition.ticket_price) &&
      edition.bets_count > 0
    ) {
      throw new BadRequestError(
        'No se puede cambiar el precio del ticket: la edición ya tiene jugadas cargadas'
      );
    }

    const updated = await this.repository.update(req.params.id, payload);
    res.status(200).json({ data: { edition: updated } });
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    await this.assertScope(req, req.params.id);
    await this.repository.softDelete(req.params.id);
    res.status(200).json({ data: { success: true } });
  });
}
