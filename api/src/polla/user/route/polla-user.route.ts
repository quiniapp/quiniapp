import { Request, Response, Router } from 'express';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import {
  POLLA_USER_TYPE,
  POLLA_USER_HIERARCHY,
  IPollaSessionUser,
} from '@helper/polla/types/user.type';
import { newPollaUserSchema, updatePollaUserSchema } from '@helper/polla/schemas/user.schema';
import { pollaCreditMovementSchema } from '@helper/polla/schemas/user.schema';
import { hashPassword } from 'api/helper/password';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaUserRepository } from '../repository/polla-user.repository';
import { parsePagination } from '../../helper/pagination';
import { resolveOptionalOrganizationId, resolveOrganizationId } from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const ALL_TYPES = Object.values(POLLA_USER_TYPE);

/** Cada rol ve y administra solo a los estrictamente inferiores. */
const visibleTypesFor = (role: POLLA_USER_TYPE): POLLA_USER_TYPE[] =>
  ALL_TYPES.filter((t) => POLLA_USER_HIERARCHY[t] > POLLA_USER_HIERARCHY[role]);

const assertCanManage = (actor: IPollaSessionUser, targetType: POLLA_USER_TYPE) => {
  if (POLLA_USER_HIERARCHY[targetType] <= POLLA_USER_HIERARCHY[actor.user_type]) {
    throw new ForbiddenError('No tenés permisos sobre ese tipo de usuario');
  }
};

export class PollaUserRouter {
  public router: Router;

  private repository = new PollaUserRepository();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    const staffOnly = requirePollaRole(
      POLLA_USER_TYPE.OWNER,
      POLLA_USER_TYPE.CAPITALIST,
      POLLA_USER_TYPE.SUPERADMIN,
      POLLA_USER_TYPE.ADMIN,
      POLLA_USER_TYPE.CASHIER
    );

    // Un jugador solo consulta su propio saldo y sus movimientos.
    this.router.get('/me/credits', this.getOwnCreditsHandler);

    this.router.get('/', staffOnly, this.getAllHandler);
    this.router.get('/:id', staffOnly, this.getByIdHandler);
    this.router.post('/', staffOnly, this.createHandler);
    this.router.put('/:id', staffOnly, this.updateHandler);
    this.router.delete('/:id', staffOnly, this.deleteHandler);

    this.router.get('/:id/credits', staffOnly, this.getCreditsHandler);
    this.router.post('/:id/credits', staffOnly, this.adjustCreditsHandler);
  }

  /** Un pasador solo alcanza a sus propios jugadores. */
  private assertReachable = async (actor: IPollaSessionUser, targetId: string) => {
    const target = await this.repository.getById(targetId);

    if (
      actor.user_type !== POLLA_USER_TYPE.OWNER &&
      target.polla_organization_id !== actor.polla_organization_id
    ) {
      throw new ForbiddenError('El usuario pertenece a otra organización');
    }

    if (
      actor.user_type === POLLA_USER_TYPE.CASHIER &&
      target.parent_polla_user_id !== actor.polla_user_id
    ) {
      throw new ForbiddenError('Solo podés administrar a tus propios jugadores');
    }

    assertCanManage(actor, target.user_type);
    return target;
  };

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);

    const requestedTypes = typeof req.query.user_type === 'string' ? [req.query.user_type] : [];
    const visible = visibleTypesFor(user.user_type);
    const userTypes = requestedTypes.length
      ? visible.filter((t) => requestedTypes.includes(t))
      : visible;

    const result = await this.repository.getAll(
      {
        organizationId: resolveOptionalOrganizationId(user, req.query.polla_organization_id),
        userTypes,
        // El pasador solo ve a sus jugadores.
        parentId:
          user.user_type === POLLA_USER_TYPE.CASHIER
            ? user.polla_user_id
            : ((req.query.parent_polla_user_id as string) ?? null),
        groupId: (req.query.polla_group_id as string) ?? null,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        includeDisabled: req.query.include_disabled === 'true',
      },
      pagination
    );

    res.status(200).json({ data: { users: result } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const target = await this.assertReachable(user, req.params.id);
    res.status(200).json({ data: { user: target } });
  });

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const body = { ...(req.body ?? {}) };

    // Un pasador solo da de alta jugadores suyos: el padre lo pone el backend,
    // no el cliente (y así el schema encuentra el campo que exige para PLAYER).
    if (user.user_type === POLLA_USER_TYPE.CASHIER) {
      if (body.user_type !== POLLA_USER_TYPE.PLAYER) {
        throw new ForbiddenError('Un pasador solo puede crear jugadores');
      }
      body.parent_polla_user_id = user.polla_user_id;
    }

    const payload = newPollaUserSchema.parse(body);

    assertCanManage(user, payload.user_type);

    const organizationId = resolveOrganizationId(user, payload.polla_organization_id);
    const parentId = payload.parent_polla_user_id ?? null;

    const { password, polla_organization_id: _ignored, ...rest } = payload;
    void _ignored;

    const created = await this.repository.create({
      ...rest,
      // La liquidación de Polla no tiene deje: el pasador no lleva recargo.
      fee_plus: payload.user_type === POLLA_USER_TYPE.CASHIER ? 0 : null,
      parent_polla_user_id: parentId,
      polla_organization_id: organizationId,
      password_hash: await hashPassword(password),
      password_changed_at: new Date().toISOString(),
    });

    res.status(201).json({ data: { user: created } });
  });

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.assertReachable(user, req.params.id);

    const payload = updatePollaUserSchema.parse(req.body);
    // fee_plus no se edita: queda en 0 (la liquidación no tiene deje).
    const { password, fee_plus: _feePlus, ...rest } = payload;
    void _feePlus;

    const updated = await this.repository.update(req.params.id, {
      ...rest,
      ...(password
        ? {
            password_hash: await hashPassword(password),
            password_changed_at: new Date().toISOString(),
            password_reset_required: false,
          }
        : {}),
    });

    res.status(200).json({ data: { user: updated } });
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.assertReachable(user, req.params.id);
    await this.repository.softDelete(req.params.id);
    res.status(200).json({ data: { success: true } });
  });

  private getCreditsHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.assertReachable(user, req.params.id);

    const pagination = parsePagination(req.query as Record<string, unknown>);
    const result = await this.repository.getCreditMovements(req.params.id, pagination);

    res.status(200).json({ data: { movements: result } });
  });

  private getOwnCreditsHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const result = await this.repository.getCreditMovements(user.polla_user_id, pagination);

    res.status(200).json({ data: { movements: result } });
  });

  private adjustCreditsHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const target = await this.assertReachable(user, req.params.id);

    if (target.user_type !== POLLA_USER_TYPE.PLAYER) {
      throw new BadRequestError('Solo los jugadores tienen créditos');
    }

    const { amount, type, reason } = pollaCreditMovementSchema.parse(req.body);

    const result = await this.repository.adjustCredits({
      playerId: req.params.id,
      amount,
      type,
      reason: reason ?? null,
      actorId: user.polla_user_id,
    });

    res.status(200).json({ data: { credits: result } });
  });
}
