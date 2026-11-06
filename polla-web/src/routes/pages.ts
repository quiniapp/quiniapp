import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { PollaPage, pollaHomePage } from '@helper/polla/config/access.config';
import { ROUTES } from '@/types/routes.type';

/** La ruta de cada pantalla de la matriz de acceso (`POLLA_PAGE_ROLES`). */
export const PAGE_PATH: Record<PollaPage, ROUTES> = {
  BETS: ROUTES.BETS,
  MAKE_BET: ROUTES.MAKE_BET,
  MANAGE_BETS: ROUTES.MANAGE_BETS,
  CHECK_TICKET: ROUTES.CHECK_TICKET,
  SALES: ROUTES.SALES,
  EDITIONS: ROUTES.EDITIONS,
  RESULTS: ROUTES.RESULTS,
  USERS: ROUTES.USERS,
  CURRENT_ACCOUNT: ROUTES.CURRENT_ACCOUNT,
  CATALOGS: ROUTES.CATALOGS,
  ORGANIZATIONS: ROUTES.ORGANIZATIONS,
  GROUPS: ROUTES.GROUPS,
  SETTINGS: ROUTES.SETTINGS,
  CHANGE_PASSWORD: ROUTES.CHANGE_PASSWORD,
};

/** Adonde entra cada rol: Jugadas; el Súper, a Cargar jugada. */
export const homePath = (role: POLLA_USER_TYPE | null | undefined) =>
  PAGE_PATH[pollaHomePage(role)];
