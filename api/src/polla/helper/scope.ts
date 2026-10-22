import { ForbiddenError } from '@helper/errors';
import {
  IPollaSessionUser,
  POLLA_USER_TYPE,
  isPollaSuperRole,
} from '@helper/polla/types/user.type';

/**
 * Resuelve sobre qué organización opera el request.
 *
 * El scope sale SIEMPRE de la sesión: cada usuario, OWNER incluido, opera solo
 * sobre su propia organización. Pedir una organización distinta es 403. El
 * OWNER administra las demás organizaciones (alta, baja y blanqueo de su
 * capitalista) únicamente desde /organization.
 */
export const resolveOrganizationId = (user: IPollaSessionUser, requested?: unknown): string => {
  const requestedId = typeof requested === 'string' && requested.length > 0 ? requested : null;

  if (requestedId && requestedId !== user.polla_organization_id) {
    throw new ForbiddenError('No podés operar sobre otra organización');
  }

  return user.polla_organization_id;
};

/**
 * Igual que `resolveOrganizationId`. Antes el OWNER podía omitir el filtro para
 * ver todas las organizaciones; ahora todos ven solo la suya.
 */
export const resolveOptionalOrganizationId = (
  user: IPollaSessionUser,
  requested?: unknown
): string | null => resolveOrganizationId(user, requested);

/**
 * Grupo dentro del cual escribe el usuario: el admin, solo en el suyo;
 * superadmin y superiores, en toda la organización (`null`). Pasador y jugador
 * no administran grupos (su alcance es él y sus jugadores).
 */
export const writableGroupId = (user: IPollaSessionUser): string | null =>
  user.user_type === POLLA_USER_TYPE.ADMIN ? user.polla_group_id : null;

/** El admin opera solo dentro de su grupo. */
export const assertInWritableGroup = (user: IPollaSessionUser, groupId: string | null) => {
  if (user.user_type === POLLA_USER_TYPE.ADMIN && groupId !== user.polla_group_id) {
    throw new ForbiddenError('Solo podés operar dentro de tu grupo');
  }
};

/** Superadmin, capitalista o dueño. */
export const assertSuperRole = (user: IPollaSessionUser) => {
  if (!isPollaSuperRole(user.user_type)) {
    throw new ForbiddenError('No tenés permisos para esta acción');
  }
};
