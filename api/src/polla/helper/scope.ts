import { ForbiddenError } from '@helper/errors';
import { IPollaSessionUser, POLLA_USER_TYPE } from '@helper/polla/types/user.type';

/**
 * Resuelve sobre qué organización (capitalist) opera el request.
 *
 * El scope sale SIEMPRE de la sesión. La única excepción es el OWNER, que puede
 * mandar `polla_organization_id` para trabajar sobre otro capitalist: para
 * cualquier otro rol, pedir una organización distinta a la propia es 403.
 */
export const resolveOrganizationId = (user: IPollaSessionUser, requested?: unknown): string => {
  const requestedId = typeof requested === 'string' && requested.length > 0 ? requested : null;

  if (!requestedId) return user.polla_organization_id;

  if (user.user_type === POLLA_USER_TYPE.OWNER) return requestedId;

  if (requestedId !== user.polla_organization_id) {
    throw new ForbiddenError('No podés operar sobre otra organización');
  }

  return requestedId;
};

/** El OWNER puede pedir "todas las organizaciones" omitiendo el filtro. */
export const resolveOptionalOrganizationId = (
  user: IPollaSessionUser,
  requested?: unknown
): string | null => {
  if (user.user_type === POLLA_USER_TYPE.OWNER) {
    return typeof requested === 'string' && requested.length > 0 ? requested : null;
  }
  return resolveOrganizationId(user, requested);
};
