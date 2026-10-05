import { IPollaUserEntityFront } from '@helper/polla/types/user.type';
import {
  IPollaBetListItem,
  IPollaBetToRepeat,
  IPollaCreditMovementEntityFront,
  IPollaCurrentAccountEntityFront,
  IPollaEditionEntityFront,
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

// ---------------------------------------------------------------- créditos

export const useCreditMovements = (playerId: string | null, params: QueryParams = {}) =>
  useApiInfiniteQuery<IPollaCreditMovementEntityFront>(
    ['polla-credits', playerId],
    playerId ? BACKEND_ROUTES.user.credits(playerId) : BACKEND_ROUTES.user.ownCredits,
    params,
    { enabled: Boolean(playerId), limit: 20 }
  );

export const useOwnCreditMovements = (params: QueryParams = {}) =>
  useApiInfiniteQuery<IPollaCreditMovementEntityFront>(
    ['polla-credits', 'me'],
    BACKEND_ROUTES.user.ownCredits,
    params,
    { limit: 20 }
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
