import { ForbiddenError } from '@helper/errors';
import { IPollaSessionUser } from '@helper/polla/types/user.type';

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
