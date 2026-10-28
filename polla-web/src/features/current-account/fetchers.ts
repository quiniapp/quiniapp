import {
  IPollaBetListItem,
  IPollaCurrentAccountDailyTotals,
  IPollaCurrentAccountPeriodRow,
  IPollaOrgExpenseEntityFront,
} from '@helper/polla/types/game.type';
import { IPollaOrganizationEntityFront } from '@helper/polla/types/catalog.type';
import { apiClient } from '@/lib/apiClient';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import { PollaPage, QueryParams, cleanParams } from '@/hooks/useApi';
import { SlipWinner } from '@/functions/current-account/liquidationSlipPDF';
import { AccountPeriodView, betsRangeFrom } from '@/lib/accountPeriod';

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

/**
 * Jugadas que ganaron en el período de cada cuenta, agrupadas por pasador (para
 * las liquidaciones).
 */
export const fetchWinnersByCashier = async (params: {
  accounts: AccountPeriodView[];
  date: string;
  /** Admin: acotar a un pasador. */
  cashierId?: string;
  /** El pasador pide las suyas (las de él y sus jugadores) con `mine`. */
  ownAsCashier?: { cashierId: string };
  organizationId?: string | null;
}) => {
  // Desde el período más viejo; después cada pasador se queda con el suyo.
  const oldest = params.accounts.reduce(
    (min, account) => (account.period_from < min ? account.period_from : min),
    params.date
  );
  const fromByCashier = new Map(
    params.accounts.map((account) => [account.polla_user_id, account.period_from])
  );

  const page = await apiClient.get<PollaPage<IPollaBetListItem>>(BACKEND_ROUTES.bet.base, {
    params: cleanParams({
      hit_from: betsRangeFrom(oldest, params.date),
      hit_to: params.date,
      winners: true,
      sort: 'recent',
      limit: 200,
      cashier_polla_user_id: params.cashierId,
      mine: params.ownAsCashier ? true : undefined,
      polla_organization_id: params.organizationId,
    }),
  });

  const byCashier = new Map<string, SlipWinner[]>();
  page.data.forEach((bet) => {
    // La proyección del pasador no trae ids: todas son de él.
    const cashierId =
      'cashier_polla_user_id' in bet ? bet.cashier_polla_user_id : params.ownAsCashier?.cashierId;
    if (!cashierId) return;
    const from = fromByCashier.get(cashierId);
    if (!from || !bet.hit_date || bet.hit_date < from) return;
    const list = byCashier.get(cashierId) ?? [];
    list.push({
      ticket_number: bet.ticket_number,
      player: bet.client_name ?? bet.identifier ?? bet.cashier_name,
      hits: bet.hits,
      prize: Number(bet.prize),
    });
    byCashier.set(cashierId, list);
  });
  return byCashier;
};
