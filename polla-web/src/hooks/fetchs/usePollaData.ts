import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  IPollaUserEntityFront,
  IPollaUserOption,
  POLLA_USER_TYPE,
} from '@helper/polla/types/user.type';
import {
  IPollaBetListItem,
  IPollaBetToRepeat,
  IPollaCurrentAccountDailyTotals,
  IPollaCurrentAccountEntityFront,
  IPollaCurrentAccountPeriodRow,
  IPollaDailySales,
  IPollaEditionAccountListItem,
  IPollaEditionAccountMovement,
  IPollaEditionAccountRow,
  IPollaEditionEntityFront,
  IPollaGroupEditionAccountEntity,
  IPollaGroupEditionLiquidation,
  IPollaGroupEditionAccountPreview,
  IPollaUserEditionAccount,
  IPollaGroupAccountEntityFront,
  IPollaOrgExpenseEntityFront,
  IPollaPrizeList,
  IPollaResultEntityFront,
  IPollaTicketCheck,
  POLLA_TICKET_SEARCH,
} from '@helper/polla/types/game.type';
import { BACKEND_ROUTES } from '@/routes/backend-routes';
import {
  PollaPage,
  QueryParams,
  useApiCursorQuery,
  useApiInfiniteQuery,
  useApiQuery,
  useRefreshCursorQuery,
} from '../useApi';

// ---------------------------------------------------------------- usuarios

export const useUsers = (params: QueryParams = {}, enabled = true) =>
  useApiInfiniteQuery<IPollaUserEntityFront>(['polla-users'], BACKEND_ROUTES.user.base, params, {
    enabled,
    limit: 50,
    keepPrevious: true,
  });

export const useUser = (id: string | null) =>
  useApiQuery<IPollaUserEntityFront>(
    ['polla-user', id],
    id ? BACKEND_ROUTES.user.id(id) : BACKEND_ROUTES.user.base,
    {},
    { enabled: Boolean(id) }
  );

/**
 * Siguiente número libre para el alta: el de un pasador en su grupo o el de un
 * jugador en su pasador (el pasador, de los suyos).
 */
export const useNextUserNumber = (
  params: {
    user_type: POLLA_USER_TYPE | '';
    polla_group_id?: string | null;
    parent_polla_user_id?: string | null;
  },
  enabled = true
) =>
  useApiQuery<number>(['polla-user-next-number'], BACKEND_ROUTES.user.nextNumber, params, {
    enabled,
    // Cada alta cambia el siguiente: se pide de nuevo al abrir el formulario.
    staleTime: 0,
    placeholderData: undefined,
  });

/** Acota el buscador: grupo, pasador (sus jugadores) o solo a quién se le puede cargar. */
export interface UserSearchScope {
  polla_group_id?: string | null;
  parent_polla_user_id?: string | null;
  /**
   * Para cargar a nombre de otro: admin+ y el Super (el admin, solo en su
   * grupo) y el pasador, a sus jugadores.
   */
  writable?: boolean;
}

/**
 * Buscador de pasadores y jugadores (`UserSearchPicker`): número exacto si `q`
 * son solo dígitos; si no, nombre, apellido y usuario. Vacío trae todos.
 */
export const useUserSearch = (
  q: string,
  userTypes: POLLA_USER_TYPE[],
  enabled = true,
  scope: UserSearchScope = {}
) =>
  useApiInfiniteQuery<IPollaUserOption>(
    ['polla-user-search'],
    BACKEND_ROUTES.user.search,
    {
      q,
      user_type: userTypes.join(','),
      polla_group_id: scope.polla_group_id,
      parent_polla_user_id: scope.parent_polla_user_id,
      scope: scope.writable ? 'writable' : undefined,
    },
    { enabled, limit: 30, keepPrevious: true }
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
    // Al tildar o destildar un período se sigue viendo la lista anterior.
    { limit: 25, keepPrevious: true }
  );

// ----------------------------------------------------------------- jugadas

const BETS_PAGE_SIZE = 50;

export const useBets = (params: QueryParams = {}, enabled = true) =>
  useApiCursorQuery<IPollaBetListItem>(['polla-bets'], BACKEND_ROUTES.bet.base, params, {
    enabled,
    limit: BETS_PAGE_SIZE,
  });

/**
 * "Actualizar" de Jugadas: la lista vuelve a la primera página con lo último
 * cargado, y se refrescan los ganadores y los totales de las ediciones (pozo y
 * cantidad de jugadas). `params` son los mismos que recibe `useBets`.
 */
export const useRefreshBets = () => {
  const queryClient = useQueryClient();
  const refreshFeed = useRefreshCursorQuery();

  return useCallback(
    (params: QueryParams) =>
      Promise.all([
        refreshFeed(['polla-bets'], params, BETS_PAGE_SIZE),
        queryClient.invalidateQueries({ queryKey: ['polla-winners'] }),
        queryClient.invalidateQueries({ queryKey: ['polla-editions'] }),
      ]),
    [queryClient, refreshFeed]
  );
};

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

/** "Revisar ticket": la jugada, su titular y el reparto del pozo de su edición. */
export const useTicketCheck = (ticketNumber: string) =>
  useApiQuery<IPollaTicketCheck>(
    ['polla-ticket-check', ticketNumber],
    BACKEND_ROUTES.bet.check(ticketNumber),
    {},
    // Un ticket que no existe es un 404 esperable: sin reintentos ni datos viejos.
    { enabled: POLLA_TICKET_SEARCH.test(ticketNumber), retry: false, placeholderData: undefined }
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

/** Los tickets propios de la última edición en que jugó (jugador), para repetirlos. */
export const useLastEditionBets = (enabled: boolean) =>
  useApiQuery<IPollaBetToRepeat[]>(
    ['polla-bet-last-edition'],
    BACKEND_ROUTES.bet.lastEdition,
    {},
    { enabled, retry: false, placeholderData: undefined }
  );

/**
 * Boletas vendidas en el día `date` o en toda la edición `polla_edition_id`
 * (total y, para admin+, por grupo).
 */
export const useDailySales = (
  params: { date?: string; polla_edition_id?: string; polla_organization_id?: string | null },
  enabled = true
) => useApiQuery<IPollaDailySales>(['polla-sales'], BACKEND_ROUTES.bet.sales, params, { enabled });

// ----------------------------------------------------------------- premios

/** Los ganadores de una edición y cuánto suman (Premios, R19). */
export const usePrizes = (params: QueryParams, enabled = true) =>
  useApiQuery<IPollaPrizeList>(['polla-prizes'], BACKEND_ROUTES.prize.base, params, { enabled });

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

/**
 * Todas las filas de un día (la tabla de liquidación no se pagina), cada una
 * con lo acumulado en el período de su pasador.
 */
export const useCurrentAccountsOfDay = (params: QueryParams = {}, enabled = true) =>
  useApiQuery<PollaPage<IPollaCurrentAccountPeriodRow>>(
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

// ------------------------------------------------------- cuenta del grupo

/** Liquidaciones de grupos de la organización (solo dueño, capitalista y superadmin; el admin usa `useMyGroupAccounts`). */
export const useGroupAccounts = (params: QueryParams = {}, enabled = true) =>
  useApiInfiniteQuery<IPollaGroupAccountEntityFront>(
    ['polla-group-accounts'],
    BACKEND_ROUTES.groupAccount.base,
    params,
    { enabled, limit: 50 }
  );

/** Las liquidaciones del grupo del admin (el servidor usa el grupo de la sesión). */
export const useMyGroupAccounts = (enabled = true) =>
  useApiInfiniteQuery<IPollaGroupAccountEntityFront>(
    ['polla-group-accounts', 'mine'],
    BACKEND_ROUTES.groupAccount.mine,
    {},
    { enabled, limit: 50 }
  );

// ------------------------------------------------------------------ gastos

export const useOrgExpenses = (
  params: {
    /** Por edición (lo normal) o, para el historial, por fecha. */
    polla_edition_id?: string;
    date?: string;
    polla_group_id?: string | null;
    polla_organization_id?: string | null;
  },
  enabled = true
) =>
  useApiQuery<IPollaOrgExpenseEntityFront[]>(
    ['polla-expenses'],
    BACKEND_ROUTES.expense.base,
    params,
    { enabled, placeholderData: undefined }
  );

// ------------------------------------------------ cuenta por edición

/**
 * Una página de ediciones con la carga cortada (de la más nueva a la más
 * vieja). Filtros: `status` (`pending` | `done`), `from`/`to` (inicio),
 * `counts: false` (sin contadores, para los selectores) y `limit` (hasta 200).
 */
export const useEditionAccountList = (params: QueryParams = {}) =>
  useApiQuery<PollaPage<IPollaEditionAccountListItem>>(
    ['edition-account', 'list'],
    BACKEND_ROUTES.editionAccount.base,
    params
  );

/** "Liquidaciones realizadas": de a 20, con scroll infinito. */
export const useDoneEditionAccounts = (params: QueryParams = {}) =>
  useApiInfiniteQuery<IPollaEditionAccountListItem>(
    ['edition-account', 'list', 'done'],
    BACKEND_ROUTES.editionAccount.base,
    { ...params, status: 'done' },
    { limit: 20 }
  );

/** La cuenta en vivo de cada pasador de la edición. */
export const useEditionAccounts = (editionId: string | null, params: QueryParams = {}) =>
  useApiQuery<IPollaEditionAccountRow[]>(
    ['edition-account', 'accounts', editionId],
    editionId
      ? BACKEND_ROUTES.editionAccount.accounts(editionId)
      : BACKEND_ROUTES.editionAccount.base,
    params,
    { enabled: Boolean(editionId) }
  );

export const useEditionMovements = (editionId: string | null, userId?: string | null) =>
  useApiQuery<IPollaEditionAccountMovement[]>(
    ['edition-account', 'movements', editionId],
    editionId
      ? BACKEND_ROUTES.editionAccount.movements(editionId)
      : BACKEND_ROUTES.editionAccount.base,
    { polla_user_id: userId },
    { enabled: Boolean(editionId) }
  );

/** Las ediciones donde el pasador tiene liquidación. */
export const useMyEditionAccounts = (enabled = true) =>
  useApiQuery<IPollaUserEditionAccount[]>(
    ['edition-account', 'mine'],
    BACKEND_ROUTES.editionAccount.mine,
    {},
    { enabled }
  );

/** Las liquidaciones por edición del grupo del admin, la más nueva primero. */
export const useMyGroupEditionLiquidations = (enabled = true) =>
  useApiQuery<IPollaGroupEditionLiquidation[]>(
    ['edition-account', 'group-mine'],
    BACKEND_ROUTES.editionAccount.groupMine,
    {},
    { enabled }
  );

export const useGroupEditionPreviews = (editionId: string | null) =>
  useApiQuery<IPollaGroupEditionAccountPreview[]>(
    ['edition-account', 'group-previews', editionId],
    editionId
      ? BACKEND_ROUTES.editionAccount.groupPreviews(editionId)
      : BACKEND_ROUTES.editionAccount.base,
    {},
    { enabled: Boolean(editionId) }
  );

/** Cuentas de grupo ya liquidadas (`polla_edition_id`, `polla_group_id`). */
export const useGroupEditionAccounts = (params: QueryParams = {}, enabled = true) =>
  useApiQuery<IPollaGroupEditionAccountEntity[]>(
    ['edition-account', 'group-accounts'],
    BACKEND_ROUTES.editionAccount.groupAccounts,
    params,
    { enabled }
  );
