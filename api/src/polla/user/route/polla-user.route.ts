import { Request, Response, Router } from 'express';
import { BadRequestError, ConflictError, ForbiddenError } from '@helper/errors';
import {
  POLLA_USER_TYPE,
  POLLA_USER_HIERARCHY,
  POLLA_USER_TYPE_LABEL,
  IPollaSessionUser,
  canCreatePollaUser,
  canResetPollaPassword,
  isPollaAdminRole,
  pollaUserListTypes,
} from '@helper/polla/types/user.type';
import {
  newPollaUserSchema,
  resetPollaPasswordSchema,
  updatePollaUserSchema,
} from '@helper/polla/schemas/user.schema';
import { hashPassword } from 'api/helper/password';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaUserRepository } from '../repository/polla-user.repository';
import { PollaAuthRepository } from '../../auth/repository/polla-auth.repository';
import { parsePagination } from '../../helper/pagination';
import {
  assertInWritableGroup,
  resolveOptionalOrganizationId,
  resolveOrganizationId,
  writableGroupId,
} from '../../helper/scope';
import { getPollaSession, requirePollaRole } from '../../middleware/polla-auth.middleware';

const queryString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const assertCanManage = (actor: IPollaSessionUser, targetType: POLLA_USER_TYPE) => {
  if (POLLA_USER_HIERARCHY[targetType] <= POLLA_USER_HIERARCHY[actor.user_type]) {
    throw new ForbiddenError('No tenés permisos sobre ese tipo de usuario');
  }
};

export class PollaUserRouter {
  public router: Router;

  private repository = new PollaUserRepository();

  private authRepository = new PollaAuthRepository();

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

    // Cargar a nombre de otro es solo de ADMIN y superiores: el pasador carga a
    // su nombre, así que no busca usuarios por número.
    const adminAndUp = requirePollaRole(
      POLLA_USER_TYPE.OWNER,
      POLLA_USER_TYPE.CAPITALIST,
      POLLA_USER_TYPE.SUPERADMIN,
      POLLA_USER_TYPE.ADMIN
    );

    this.router.get('/', staffOnly, this.getAllHandler);
    // Todos buscan pasadores y jugadores para filtrar las jugadas (que ya ven
    // con nombre); `scope=writable` es para cargar a nombre de otro (admin+).
    this.router.get('/search', this.searchHandler);
    this.router.get('/by-number/:number', adminAndUp, this.getByNumberHandler);
    this.router.get('/:id', staffOnly, this.getByIdHandler);
    this.router.post('/', staffOnly, this.createHandler);
    this.router.put('/:id', staffOnly, this.updateHandler);
    this.router.post('/:id/reset-password', staffOnly, this.resetPasswordHandler);
    this.router.delete('/:id', staffOnly, this.deleteHandler);
  }

  /**
   * Un pasador solo alcanza a sus propios jugadores; el admin, a los
   * pasadores y jugadores de su grupo.
   */
  private assertReachable = async (actor: IPollaSessionUser, targetId: string) => {
    const target = await this.repository.getById(targetId);

    if (target.polla_organization_id !== actor.polla_organization_id) {
      throw new ForbiddenError('El usuario pertenece a otra organización');
    }

    if (
      actor.user_type === POLLA_USER_TYPE.CASHIER &&
      target.parent_polla_user_id !== actor.polla_user_id
    ) {
      throw new ForbiddenError('Solo podés administrar a tus propios jugadores');
    }

    assertInWritableGroup(actor, target.polla_group_id);
    assertCanManage(actor, target.user_type);
    return target;
  };

  /** El jugador cuelga de un pasador activo; el admin elige uno de su grupo. */
  private assertParentInScope = async (actor: IPollaSessionUser, parentId: string) => {
    const parent = await this.repository.getById(parentId);

    if (parent.user_type !== POLLA_USER_TYPE.CASHIER) {
      throw new BadRequestError('El jugador tiene que colgar de un pasador');
    }
    if (parent.polla_organization_id !== actor.polla_organization_id) {
      throw new ForbiddenError('El pasador pertenece a otra organización');
    }
    assertInWritableGroup(actor, parent.polla_group_id);
  };

  /**
   * El número es único por tipo dentro de la organización: un pasador y un
   * jugador pueden compartirlo, dos jugadores no. Se chequea antes para dar un
   * mensaje claro; el índice único queda de respaldo.
   */
  private assertNumberFree = async (params: {
    organizationId: string;
    userType: POLLA_USER_TYPE;
    number: number | null | undefined;
    excludeId?: string;
  }) => {
    if (params.number === null || params.number === undefined) return;

    const taken = await this.repository.isNumberTaken({ ...params, number: params.number });
    if (taken) {
      throw new ConflictError(
        `Ese número de ${POLLA_USER_TYPE_LABEL[params.userType].toLowerCase()} ya está en uso`
      );
    }
  };

  private getAllHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);

    // Cada rol lista a los estrictamente inferiores, sin el capitalista: se ve
    // y se administra desde Organizaciones (pedirlo por `user_type` no lo trae).
    const requestedTypes = typeof req.query.user_type === 'string' ? [req.query.user_type] : [];
    const visible = pollaUserListTypes(user.user_type);
    const userTypes = requestedTypes.length
      ? visible.filter((t) => requestedTypes.includes(t))
      : visible;

    const result = await this.repository.getAll(
      {
        organizationId: resolveOptionalOrganizationId(user, req.query.polla_organization_id),
        userTypes,
        // El pasador solo ve a sus jugadores; el admin, los de su grupo.
        parentId:
          user.user_type === POLLA_USER_TYPE.CASHIER
            ? user.polla_user_id
            : queryString(req.query.parent_polla_user_id),
        groupId: writableGroupId(user) ?? queryString(req.query.polla_group_id),
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        includeDisabled: req.query.include_disabled === 'true',
      },
      pagination
    );

    res.status(200).json({ data: { users: result } });
  });

  /**
   * Buscador para elegir un pasador o jugador de una lista: `q` con solo
   * dígitos es el número exacto; otro texto busca en nombre, apellido y
   * usuario. `user_type` acota los tipos (separados por coma); `polla_group_id`
   * y `parent_polla_user_id`, el grupo y el pasador.
   *
   * Todos lo usan para filtrar jugadas (solo datos públicos). Con
   * `scope=writable` es para cargar a nombre de otro: ADMIN+ y, el admin, solo
   * dentro de su grupo.
   */
  private searchHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const writable = req.query.scope === 'writable';

    if (writable && !isPollaAdminRole(user.user_type)) {
      throw new ForbiddenError('Solo podés cargar jugadas a tu nombre');
    }

    const requested = typeof req.query.user_type === 'string' ? req.query.user_type.split(',') : [];
    const searchable = [POLLA_USER_TYPE.CASHIER, POLLA_USER_TYPE.PLAYER];
    const userTypes = requested.length
      ? searchable.filter((t) => requested.includes(t))
      : searchable;

    if (userTypes.length === 0) {
      throw new BadRequestError('Tipo de usuario inválido');
    }

    const result = await this.repository.search(
      {
        organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
        userTypes,
        q: typeof req.query.q === 'string' ? req.query.q : '',
        groupId: (writable ? writableGroupId(user) : null) ?? queryString(req.query.polla_group_id),
        parentId: queryString(req.query.parent_polla_user_id),
      },
      pagination
    );

    res.status(200).json({ data: { users: result } });
  });

  /**
   * Pasador o jugador de la organización por número, para cargarle una jugada
   * (ADMIN+; el admin, solo de su grupo).
   */
  private getByNumberHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const number = Number(req.params.number);

    if (!/^\d{1,9}$/.test(req.params.number) || !Number.isSafeInteger(number) || number <= 0) {
      throw new BadRequestError('Número inválido');
    }

    const found = await this.repository.getByNumber({
      organizationId: resolveOrganizationId(user, req.query.polla_organization_id),
      number,
      userTypes: [POLLA_USER_TYPE.CASHIER, POLLA_USER_TYPE.PLAYER],
      parentId: null,
      groupId: writableGroupId(user),
    });

    res.status(200).json({ data: { user: found } });
  });

  private getByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const target = await this.assertReachable(user, req.params.id);
    res.status(200).json({ data: { user: target } });
  });

  private createHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const body = { ...(req.body ?? {}) };

    if (!canCreatePollaUser(user.user_type, body.user_type)) {
      throw new ForbiddenError('No podés crear ese tipo de usuario');
    }

    // El jugador de un pasador lo pone el backend, no el cliente (y así el
    // schema encuentra el campo que exige). Si lo crea un superior, elige el
    // pasador y el trigger valida que sea un pasador activo de la organización.
    if (user.user_type === POLLA_USER_TYPE.CASHIER) {
      body.parent_polla_user_id = user.polla_user_id;
    }

    const payload = newPollaUserSchema.parse(body);

    const organizationId = resolveOrganizationId(user, payload.polla_organization_id);
    const parentId = payload.parent_polla_user_id ?? null;

    // El admin elige el pasador del jugador dentro de su grupo.
    if (
      payload.user_type === POLLA_USER_TYPE.PLAYER &&
      user.user_type !== POLLA_USER_TYPE.CASHIER
    ) {
      await this.assertParentInScope(user, parentId!);
    }

    const {
      password,
      polla_organization_id: _ignored,
      polla_group_id: requestedGroup,
      ...rest
    } = payload;
    void _ignored;

    // Grupo fijo desde el alta: el pasador del admin queda en su grupo; el de
    // un superadmin+, en el que elija (o sin grupo). El jugador toma el de su
    // pasador (lo resuelve la base).
    const groupId =
      payload.user_type === POLLA_USER_TYPE.CASHIER
        ? (writableGroupId(user) ?? requestedGroup ?? null)
        : null;

    await this.assertNumberFree({
      organizationId,
      userType: payload.user_type,
      number: payload.number,
    });

    const created = await this.repository.create({
      ...rest,
      // La liquidación de Polla no tiene deje: el pasador no lleva recargo.
      fee_plus: payload.user_type === POLLA_USER_TYPE.CASHIER ? 0 : null,
      parent_polla_user_id: parentId,
      polla_group_id: groupId,
      polla_organization_id: organizationId,
      password_hash: await hashPassword(password),
      password_changed_at: new Date().toISOString(),
    });

    res.status(201).json({ data: { user: created } });
  });

  private updateHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const target = await this.assertReachable(user, req.params.id);

    const payload = updatePollaUserSchema.parse(req.body);
    // fee_plus no se edita: queda en 0 (la liquidación no tiene deje). La
    // contraseña se cambia solo con el blanqueo de un superior. El grupo no se
    // cambia: el del pasador queda fijo al crearlo y el del jugador sale de su
    // pasador (el admin del modelo viejo se asigna desde Grupos).
    const {
      fee_plus: _feePlus,
      polla_group_id: _group,
      parent_polla_user_id: parentId,
      fee,
      ...rest
    } = payload;
    void _feePlus;
    void _group;

    if (rest.number !== undefined && rest.number !== target.number) {
      await this.assertNumberFree({
        organizationId: target.polla_organization_id,
        userType: target.user_type,
        number: rest.number,
        excludeId: target.polla_user_id,
      });
    }

    const changes: Record<string, unknown> = { ...rest };

    // La comisión es del pasador y la fija un superior; el pasador de un
    // jugador solo lo cambia un ADMIN+, a otro del mismo grupo (la base lo
    // vuelve a controlar).
    if (target.user_type === POLLA_USER_TYPE.CASHIER && fee !== undefined) changes.fee = fee;
    if (
      target.user_type === POLLA_USER_TYPE.PLAYER &&
      parentId &&
      parentId !== target.parent_polla_user_id &&
      isPollaAdminRole(user.user_type)
    ) {
      await this.assertParentInScope(user, parentId);
      changes.parent_polla_user_id = parentId;
    }

    const updated = await this.repository.update(req.params.id, changes);

    res.status(200).json({ data: { user: updated } });
  });

  /**
   * La contraseña la pone siempre un superior y queda definitiva: nadie se la
   * cambia a sí mismo y cada rol blanquea solo a ciertos tipos (ver
   * `POLLA_PASSWORD_RESET_TARGETS`).
   */
  private resetPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);

    if (req.params.id === user.polla_user_id) {
      throw new ForbiddenError('No podés cambiar tu propia contraseña');
    }

    const target = await this.assertReachable(user, req.params.id);

    if (!canResetPollaPassword(user.user_type, target.user_type)) {
      throw new ForbiddenError('No podés blanquear la contraseña de ese tipo de usuario');
    }

    const { password } = resetPollaPasswordSchema.parse(req.body);
    await this.authRepository.resetPassword(req.params.id, await hashPassword(password));

    res.status(200).json({ data: { success: true } });
  });

  private deleteHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    await this.assertReachable(user, req.params.id);
    await this.repository.softDelete(req.params.id);
    res.status(200).json({ data: { success: true } });
  });
}
