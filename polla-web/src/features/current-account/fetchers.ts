import {
  IPollaCurrentAccountDailyTotals,
  IPollaCurrentAccountPeriodRow,
  IPollaOrgExpenseEntityFront,
} from '@helper/polla/types/game.type';
import { IPollaOrganizationEntityFront } from '@helper/polla/types/catalog.type';
import { apiClient } from '@/lib/apiClient';
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
