import {
  IPollaCurrentAccountDailyTotals,
  IPollaCurrentAccountPeriodRow,
  IPollaEditionAccountRow,
  IPollaEditionAccountTotals,
  IPollaOrgExpenseEntityFront,
} from '@helper/polla/types/game.type';
import { IPollaOrganizationEntityFront } from '@helper/polla/types/catalog.type';
import { apiClient } from '@/lib/apiClient';
import { chunk } from '@/lib/utils';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import { PollaPage, QueryParams, cleanParams } from '@/hooks/useApi';

/**
 * Lecturas puntuales para los exportes: se piden al apretar el botón, con los
 * filtros del diálogo, en vez de mantener queries abiertas.
 */

/** Filas del día con lo acumulado en el período de cada pasador. */
export const fetchAccountsOfDay = async (params: QueryParams) =>
  (
    await apiClient.get<PollaPage<IPollaCurrentAccountPeriodRow>>(
      BACKEND_ROUTES.currentAccount.base,
      { params: cleanParams({ ...params, limit: 200 }) }
    )
  ).data;

export const fetchDailyTotals = (params: QueryParams) =>
  apiClient.get<IPollaCurrentAccountDailyTotals[]>(BACKEND_ROUTES.currentAccount.totals, {
    params: cleanParams(params),
  });

/** Cuenta en vivo de cada pasador de una edición. */
export const fetchEditionAccounts = (editionId: string, params: QueryParams = {}) =>
  apiClient.get<IPollaEditionAccountRow[]>(BACKEND_ROUTES.editionAccount.accounts(editionId), {
    params: cleanParams(params),
  });

/** La API admite hasta 60 ediciones por pedido de totales (los ids van en la URL). */
export const EDITION_TOTALS_PER_REQUEST = 60;

/**
 * Una fila por edición (`date` = inicio de la edición). Con más de 60 parte el
 * pedido en tandas (una después de la otra) y junta las filas en el mismo
 * orden.
 */
export const fetchEditionTotals = async (
  editionIds: string[],
  groupId: string | null,
  organizationId: string | null
) => {
  const rows: IPollaEditionAccountTotals[] = [];
  for (const ids of chunk(editionIds, EDITION_TOTALS_PER_REQUEST)) {
    rows.push(
      ...(await apiClient.get<IPollaEditionAccountTotals[]>(BACKEND_ROUTES.editionAccount.totals, {
        params: cleanParams({
          polla_edition_ids: ids.join(','),
          polla_group_id: groupId,
          polla_organization_id: organizationId,
        }),
      }))
    );
  }
  return rows;
};

export const fetchExpenses = (params: QueryParams) =>
  apiClient.get<IPollaOrgExpenseEntityFront[]>(BACKEND_ROUTES.expense.base, {
    params: cleanParams(params),
  });

export const fetchOrganizationName = async (organizationId: string | null) => {
  if (!organizationId) return '';
  try {
    const organization = await apiClient.get<IPollaOrganizationEntityFront>(
      BACKEND_ROUTES.organization.id(organizationId)
    );
    return organization.name ?? '';
  } catch {
    return '';
  }
};
