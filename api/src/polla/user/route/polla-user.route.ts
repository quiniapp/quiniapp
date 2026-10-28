import { Request, Response, Router } from 'express';
import { BadRequestError, ConflictError, ForbiddenError } from '@helper/errors';
import {
  POLLA_USER_TYPE,
  POLLA_USER_HIERARCHY,
  IPollaSessionUser,
  canBePollaStreetUser,
  canCreatePollaUser,
  canResetPollaPassword,
  isPollaAdminRole,
  isPollaLoaderRole,
  pollaUserListTypes,
} from '@helper/polla/types/user.type';
import {
  newPollaUserSchema,
  resetPollaPasswordSchema,
  updatePollaUserSchema,
} from '@helper/polla/schemas/user.schema';
import { hashPassword } from 'api/helper/password';
import { asyncHandler } from 'api/src/middlewares/error.middleware';
import { PollaNumberScope, PollaUserRepository } from '../repository/polla-user.repository';
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

    // Cargar a nombre de otro por número es de ADMIN y superiores.
    const adminAndUp = requirePollaRole(
      POLLA_USER_TYPE.OWNER,
      POLLA_USER_TYPE.CAPITALIST,
      POLLA_USER_TYPE.SUPERADMIN,
      POLLA_USER_TYPE.ADMIN
    );

    // El Super no administra usuarios, pero trae por id al pasador o jugador
    // con que filtra las jugadas.
    const staffAndAssistant = requirePollaRole(
      POLLA_USER_TYPE.OWNER,
      POLLA_USER_TYPE.CAPITALIST,
      POLLA_USER_TYPE.SUPERADMIN,
      POLLA_USER_TYPE.ASSISTANT,
      POLLA_USER_TYPE.ADMIN,
      POLLA_USER_TYPE.CASHIER
    );

    this.router.get('/', staffOnly, this.getAllHandler);
    // Todos buscan pasadores y jugadores para filtrar las jugadas (que ya ven
    // con nombre); `scope=writable` es para cargar a nombre de otro.
    this.router.get('/search', this.searchHandler);
    this.router.get('/next-number', staffOnly, this.nextNumberHandler);
    this.router.get('/by-number/:number', adminAndUp, this.getByNumberHandler);
    this.router.get('/:id', staffAndAssistant, this.getByIdHandler);
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
   * El número del pasador es único dentro de su grupo (los sin grupo, entre
   * ellos) y el del jugador, dentro de su pasador: se repiten entre grupos y
   * pasadores. Se chequea antes para dar un mensaje claro; los índices únicos
   * quedan de respaldo.
   */
  private assertNumberFree = async (params: {
    organizationId: string;
    scope: PollaNumberScope | null;
    number: number | null | undefined;
    excludeId?: string;
  }) => {
    if (params.number === null || params.number === undefined || !params.scope) return;

    const taken = await this.repository.isNumberTaken({
      organizationId: params.organizationId,
      scope: params.scope,
      number: params.number,
      excludeId: params.excludeId,
    });
    if (taken) {
      throw new ConflictError(
        params.scope.userType === POLLA_USER_TYPE.CASHIER
          ? 'Ese número de pasador ya está en uso en el grupo'
          : 'Ese número de jugador ya está en uso en el pasador'
      );
    }
  };

  /** Ámbito del número de un pasador (su grupo) o de un jugador (su pasador). */
  private numberScope = (
    userType: POLLA_USER_TYPE,
    groupId: string | null,
    parentId: string | null
  ): PollaNumberScope | null => {
    if (userType === POLLA_USER_TYPE.CASHIER) return { userType, groupId };
    if (userType === POLLA_USER_TYPE.PLAYER && parentId) return { userType, parentId };
    return null;
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
   * dígitos es el número exacto; `2-5`, el pasador 5 del grupo 2; otro texto
   * busca en nombre, apellido y usuario. `user_type` acota los tipos
   * (separados por coma); `polla_group_id` y `parent_polla_user_id`, el grupo
   * y el pasador.
   *
   * Todos lo usan para filtrar jugadas (solo datos públicos). Con
   * `scope=writable` es para cargar a nombre de otro: ADMIN+ y el Super (el
   * admin, solo dentro de su grupo) y el pasador, solo a sus jugadores.
   */
  private searchHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const writable = req.query.scope === 'writable';
    const cashierLoading = writable && user.user_type === POLLA_USER_TYPE.CASHIER;

    if (writable && !isPollaLoaderRole(user.user_type) && !cashierLoading) {
      throw new ForbiddenError('Solo podés cargar jugadas a tu nombre');
    }

    const requested = typeof req.query.user_type === 'string' ? req.query.user_type.split(',') : [];
    const searchable = cashierLoading
      ? [POLLA_USER_TYPE.PLAYER]
      : [POLLA_USER_TYPE.CASHIER, POLLA_USER_TYPE.PLAYER];
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
        parentId: cashierLoading ? user.polla_user_id : queryString(req.query.parent_polla_user_id),
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

  /**
   * Siguiente número libre para el alta: el de un pasador en un grupo
   * (`polla_group_id`; sin grupo si falta, y el admin siempre en el suyo) o el
   * de un jugador de un pasador (`parent_polla_user_id`; el pasador, de los
   * suyos).
   */
  private nextNumberHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = getPollaSession(req);
    const userType = req.query.user_type;
    const organizationId = resolveOrganizationId(user, req.query.polla_organization_id);

    let scope: PollaNumberScope | null = null;
    if (userType === POLLA_USER_TYPE.CASHIER) {
      scope = {
        userType,
        groupId: writableGroupId(user) ?? queryString(req.query.polla_group_id),
      };
    } else if (userType === POLLA_USER_TYPE.PLAYER) {
      const parentId =
        user.user_type === POLLA_USER_TYPE.CASHIER
          ? user.polla_user_id
          : queryString(req.query.parent_polla_user_id);
      if (parentId) {
        if (user.user_type !== POLLA_USER_TYPE.CASHIER) {
          await this.assertParentInScope(user, parentId);
        }
        scope = { userType, parentId };
      }
    }

    if (!scope) throw new BadRequestError('Falta el grupo o el pasador');

    const number = await this.repository.nextNumber(organizationId, scope);
    res.status(200).json({ data: { number } });
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
      is_street: street,
      ...rest
    } = payload;
    void _ignored;
    // De calle: sin usuario ni contraseña, no entra (el schema ya lo controló).
    const isStreet = Boolean(street);

    // Grupo fijo desde el alta: el pasador del admin queda en su grupo; el de
    // un superadmin+, en el que elija (o sin grupo). El jugador toma el de su
    // pasador (lo resuelve la base).
    const groupId =
      payload.user_type === POLLA_USER_TYPE.CASHIER
        ? (writableGroupId(user) ?? requestedGroup ?? null)
        : null;

    await this.assertNumberFree({
      organizationId,
      scope: this.numberScope(payload.user_type, groupId, parentId),
      number: payload.number,
    });

    const created = await this.repository.create({
      ...rest,
      // La liquidación de Polla no tiene deje: el pasador no lleva recargo.
      fee_plus: payload.user_type === POLLA_USER_TYPE.CASHIER ? 0 : null,
      parent_polla_user_id: parentId,
      polla_group_id: groupId,
      polla_organization_id: organizationId,
      is_street: isStreet,
      username: isStreet ? null : (rest.username ?? null),
      password_hash: isStreet || !password ? null : await hashPassword(password),
      password_changed_at: isStreet ? null : new Date().toISOString(),
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
      is_street: street,
      password,
      ...rest
    } = payload;
    void _feePlus;
    void _group;

    const changesParent =
      target.user_type === POLLA_USER_TYPE.PLAYER &&
      Boolean(parentId) &&
      parentId !== target.parent_polla_user_id &&
      isPollaAdminRole(user.user_type);
    const finalNumber = rest.number !== undefined ? rest.number : target.number;

    // El número se controla en su ámbito final: un jugador que cambia de
    // pasador no puede chocar con los del nuevo.
    if (finalNumber !== target.number || changesParent) {
      await this.assertNumberFree({
        organizationId: target.polla_organization_id,
        scope: this.numberScope(
          target.user_type,
          target.polla_group_id,
          changesParent ? parentId! : target.parent_polla_user_id
        ),
        number: finalNumber,
        excludeId: target.polla_user_id,
      });
    }

    const changes: Record<string, unknown> = { ...rest };

    // Aplicación → calle: se borran usuario y contraseña y se cierran sus
    // sesiones. Calle → aplicación: necesita usuario y contraseña.
    const toStreet = street === true && !target.is_street;
    const toApp = street === false && target.is_street;
    const staysStreet = target.is_street && !toApp;

    if (street === true && !canBePollaStreetUser(target.user_type)) {
      throw new BadRequestError('Solo pasadores y jugadores pueden ser de calle');
    }
    if (toStreet || staysStreet) {
      changes.username = null;
    }
    if (toStreet) {
      changes.is_street = true;
      changes.password_hash = null;
      changes.password_changed_at = null;
    }
    if (toApp) {
      if (!rest.username || !password) {
        throw new BadRequestError('Para que entre a la aplicación necesita usuario y contraseña');
      }
      changes.is_street = false;
      changes.password_hash = await hashPassword(password);
      changes.password_changed_at = new Date().toISOString();
    }

    // La comisión es del pasador y la fija un superior; el pasador de un
    // jugador solo lo cambia un ADMIN+, a otro del mismo grupo (la base lo
    // vuelve a controlar).
    if (target.user_type === POLLA_USER_TYPE.CASHIER && fee !== undefined) changes.fee = fee;
    if (changesParent) {
      await this.assertParentInScope(user, parentId!);
      changes.parent_polla_user_id = parentId;
    }

    const updated = await this.repository.update(req.params.id, changes);
    if (toStreet) await this.authRepository.revokeAllSessions(target.polla_user_id);

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
    if (target.is_street) {
      throw new BadRequestError('Es de calle: no tiene contraseña (pasalo a aplicación)');
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
