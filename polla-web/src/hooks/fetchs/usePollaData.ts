import { IPollaUserByNumber, IPollaUserEntityFront } from '@helper/polla/types/user.type';
import {
  IPollaBetListItem,
  IPollaBetToRepeat,
  IPollaCurrentAccountDailyTotals,
  IPollaCurrentAccountEntityFront,
  IPollaDailySales,
  IPollaEditionEntityFront,
  IPollaOrgExpenseEntityFront,
  IPollaResultEntityFront,
} from '@helper/polla/types/game.type';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import {
  PollaPage,
  QueryParams,
  useApiCursorQuery,
  useApiInfiniteQuery,
  useApiQuery,
} from '../useApi';

// ---------------------------------------------------------------- usuarios

export const useUsers = (params: QueryParams = {}, enabled = true) =>
  useApiInfiniteQuery<IPollaUserEntityFront>(['polla-users'], BACKEND_ROUTES.user.base, params, {
    enabled,
    limit: 50,
  });

/** Versión no paginada para los combos (pasador, jugador destino). */
export const useUserOptions = (params: QueryParams = {}, enabled = true) =>
  useApiQuery<PollaPage<IPollaUserEntityFront>>(
    ['polla-user-options'],
    BACKEND_ROUTES.user.base,
    { limit: 200, ...params },
    { enabled }
  );

export const useUser = (id: string | null) =>
  useApiQuery<IPollaUserEntityFront>(
    ['polla-user', id],
    id ? BACKEND_ROUTES.user.id(id) : BACKEND_ROUTES.user.base,
    {},
    { enabled: Boolean(id) }
  );

/**
 * Pasador o jugador por número, para cargarle una jugada a su nombre. Un número
 * que no existe es un 404 esperable: sin reintentos ni datos viejos.
 */
export const useUserByNumber = (number: string, organizationId?: string | null) =>
  useApiQuery<IPollaUserByNumber>(
    ['polla-user-by-number', number],
    BACKEND_ROUTES.user.byNumber(number),
    { polla_organization_id: organizationId },
    { enabled: /^\d{1,9}$/.test(number), retry: false, placeholderData: undefined }
  );

// --------------------------------------------------------------- ediciones

/** Las ediciones alimentan combos además de su propia pantalla. */
export const useEditions = (params: QueryParams = {}) =>
  useApiQuery<PollaPage<IPollaEditionEntityFront>>(
    ['polla-editions'],
    BACKEND_ROUTES.edition.base,
    { limit: 100, ...params }
  );

export const useEditionList = (params: QueryParams = {}) =>
  useApiInfiniteQuery<IPollaEditionEntityFront>(
    ['polla-editions'],
    BACKEND_ROUTES.edition.base,
    params,
    { limit: 25 }
  );

// ----------------------------------------------------------------- jugadas

export const useBets = (params: QueryParams = {}, enabled = true) =>
  useApiCursorQuery<IPollaBetListItem>(['polla-bets'], BACKEND_ROUTES.bet.base, params, {
    enabled,
    limit: 50,
  });

export const useWinners = (editionId: string | null) =>
  useApiQuery<PollaPage<IPollaBetListItem>>(
    ['polla-winners', editionId],
    BACKEND_ROUTES.bet.winners,
    { polla_edition_id: editionId },
    { enabled: Boolean(editionId) }
  );

/** Números de un ticket propio para repetirlo. */
export const useBetToRepeat = (ticketNumber: string | null) =>
  useApiQuery<IPollaBetToRepeat>(
    ['polla-bet-ticket', ticketNumber],
    ticketNumber ? BACKEND_ROUTES.bet.ticket(ticketNumber) : BACKEND_ROUTES.bet.base,
    {},
    // Un ticket que no existe es un 404 esperable: sin reintentos ni datos viejos.
    { enabled: Boolean(ticketNumber), retry: false, placeholderData: undefined }
  );

/**
 * Jugadas de un día sin paginar (para la liquidación): las cargadas ese día
 * (`load_date`) o las que ganaron ese día (`hit_date` + `winners`).
 */
export const useBetsOfDay = (params: QueryParams, enabled = true) =>
  useApiQuery<PollaPage<IPollaBetListItem>>(
    ['polla-bets', 'day'],
    BACKEND_ROUTES.bet.base,
    { sort: 'recent', limit: 200, ...params },
    { enabled, placeholderData: undefined }
  );

/** La última jugada propia, para "Repetir última jugada". */
export const useLastBet = (enabled: boolean) =>
  useApiQuery<IPollaBetToRepeat>(
    ['polla-bet-last'],
    BACKEND_ROUTES.bet.last,
    {},
    { enabled, retry: false, placeholderData: undefined }
  );

/** Boletas vendidas en el día (total y, para admin+, por grupo). */
export const useDailySales = (params: { date: string; polla_organization_id?: string | null }) =>
  useApiQuery<IPollaDailySales>(['polla-sales'], BACKEND_ROUTES.bet.sales, params);

// -------------------------------------------------------------- resultados

export const useResults = (params: QueryParams = {}) =>
  useApiInfiniteQuery<IPollaResultEntityFront>(
    ['polla-results'],
    BACKEND_ROUTES.result.base,
    params,
    { limit: 25 }
  );

/** El resultado ya cargado para un día, quiniela y turno (para corregirlo). */
export const useResultFor = (
  params: {
    date: string;
    polla_lottery_id: string;
    polla_schedule_id: string;
    polla_organization_id?: string;
  },
  enabled: boolean
) =>
  useApiQuery<PollaPage<IPollaResultEntityFront>>(
    ['polla-results', 'one'],
    BACKEND_ROUTES.result.base,
    { ...params, limit: 1 },
    { enabled, placeholderData: undefined }
  );

// --------------------------------------------------------- cuenta corriente

export const useCurrentAccounts = (params: QueryParams = {}, enabled = true) =>
  useApiInfiniteQuery<IPollaCurrentAccountEntityFront>(
    ['polla-current-accounts'],
    BACKEND_ROUTES.currentAccount.base,
    params,
    { enabled, limit: 50 }
  );

/** Todas las filas de un día: la tabla de liquidación no se pagina. */
export const useCurrentAccountsOfDay = (params: QueryParams = {}, enabled = true) =>
  useApiQuery<PollaPage<IPollaCurrentAccountEntityFront>>(
    ['polla-current-accounts', 'day'],
    BACKEND_ROUTES.currentAccount.base,
    { limit: 200, ...params },
    { enabled }
  );

/** Totales por día entre `from` y `to`. */
export const useCurrentAccountTotals = (params: QueryParams = {}, enabled = true) =>
  useApiQuery<IPollaCurrentAccountDailyTotals[]>(
    ['polla-current-accounts', 'totals'],
    BACKEND_ROUTES.currentAccount.totals,
    params,
    { enabled }
  );

// ------------------------------------------------------------------ gastos

export const useOrgExpenses = (
  params: { date: string; polla_group_id?: string | null; polla_organization_id?: string | null },
  enabled = true
) =>
  useApiQuery<IPollaOrgExpenseEntityFront[]>(
    ['polla-expenses'],
    BACKEND_ROUTES.expense.base,
    params,
    { enabled, placeholderData: undefined }
  );
