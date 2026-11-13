import { POLLA_ACCOUNT_ROLES, POLLA_SUPER_ROLES, POLLA_USER_TYPE } from '../types/user.type';

/**
 * Qué pantalla ve cada rol, en un solo lugar: la usan las rutas y el menú de
 * polla-web, y la API arma con esto los guards de los endpoints que sirven a
 * una sola pantalla (`POLLA_API_ROLES`). Así el menú y el backend no se
 * desfasan.
 */
export type PollaPage =
  | 'BETS'
  | 'MAKE_BET'
  | 'MANAGE_BETS'
  | 'CHECK_TICKET'
  | 'SALES'
  | 'EDITIONS'
  | 'RESULTS'
  | 'USERS'
  | 'CURRENT_ACCOUNT'
  | 'PRIZES'
  | 'CATALOGS'
  | 'ORGANIZATIONS'
  | 'GROUPS'
  | 'SETTINGS'
  | 'CHANGE_PASSWORD';

const ALL_ROLES = Object.values(POLLA_USER_TYPE);

const allBut = (...excluded: POLLA_USER_TYPE[]) =>
  ALL_ROLES.filter((role) => !excluded.includes(role));

/** Superadmin+ y el admin de grupo. */
const ADMIN_AND_UP = [...POLLA_SUPER_ROLES, POLLA_USER_TYPE.ADMIN];

/** Los que ven la operación (ventas, usuarios, revisar ticket): admin+ y el pasador. */
const OPERATION = [...ADMIN_AND_UP, POLLA_USER_TYPE.CASHIER];

/** Los que cargan y administran jugadas: la operación y el Súper. */
const BET_LOADERS = [...OPERATION, POLLA_USER_TYPE.ASSISTANT];

/**
 * El Súper (ASSISTANT, R11) solo ve Cargar jugada, Administrar jugadas y
 * Configuración. El resto, como hasta ahora.
 */
export const POLLA_PAGE_ROLES: Record<PollaPage, readonly POLLA_USER_TYPE[]> = {
  BETS: allBut(POLLA_USER_TYPE.ASSISTANT),
  MAKE_BET: [POLLA_USER_TYPE.PLAYER, ...BET_LOADERS],
  MANAGE_BETS: BET_LOADERS,
  CHECK_TICKET: OPERATION,
  SALES: OPERATION,
  EDITIONS: POLLA_SUPER_ROLES,
  RESULTS: allBut(POLLA_USER_TYPE.ASSISTANT),
  USERS: OPERATION,
  // Dueño, capitalista y superadmin; el pasador ve la suya.
  CURRENT_ACCOUNT: [...POLLA_ACCOUNT_ROLES, POLLA_USER_TYPE.CASHIER],
  // Premios (R19, R21): superadmin+ toda la organización; el admin su grupo; el
  // pasador lo imputado a él; el jugador lo suyo. El Súper no.
  PRIZES: [...ADMIN_AND_UP, POLLA_USER_TYPE.CASHIER, POLLA_USER_TYPE.PLAYER],
  CATALOGS: POLLA_SUPER_ROLES,
  ORGANIZATIONS: [POLLA_USER_TYPE.OWNER],
  GROUPS: POLLA_SUPER_ROLES,
  SETTINGS: ALL_ROLES,
  CHANGE_PASSWORD: ALL_ROLES,
};

export const canSeePollaPage = (role: POLLA_USER_TYPE | null | undefined, page: PollaPage) =>
  Boolean(role && POLLA_PAGE_ROLES[page].includes(role));

/** Adonde entra cada rol: Jugadas o, para el Súper, Cargar jugada. */
export const pollaHomePage = (role: POLLA_USER_TYPE | null | undefined): PollaPage =>
  canSeePollaPage(role, 'BETS') ? 'BETS' : 'MAKE_BET';

/**
 * Endpoints que sirven a una sola pantalla: los ve el mismo grupo de roles. El
 * Súper no tiene acceso a ninguno de estos.
 */
export const POLLA_API_ROLES = {
  /** `GET /bet` sin `view=manage` (Jugadas, su PDF y la cuenta corriente). */
  readAllBets: POLLA_PAGE_ROLES.BETS,
  /** `GET /bet/check/:ticket` (Revisar ticket). */
  checkTicket: POLLA_PAGE_ROLES.CHECK_TICKET,
  /** `GET /bet/sales` (Ventas del día). */
  sales: POLLA_PAGE_ROLES.SALES,
  /** `GET /result` (Resultados). */
  readResults: POLLA_PAGE_ROLES.RESULTS,
  /** `GET /prize` (Premios). */
  readPrizes: POLLA_PAGE_ROLES.PRIZES,
} satisfies Record<string, readonly POLLA_USER_TYPE[]>;

/** De quién son los premios que ve cada rol (R21). `null`: no ve premios. */
export interface PollaPrizeScope {
  /** Solo los imputados a este pasador (lo suyo y lo de sus jugadores). */
  cashierId?: string;
  /** Solo los de este grupo. */
  groupId?: string;
  /** Solo los tickets de este jugador. */
  userId?: string;
  /** Ve si el premio está pagado (el jugador no: es entre el capitalista y el pasador). */
  seesPaid: boolean;
}

export const pollaPrizeScope = (user: {
  polla_user_id: string;
  user_type: POLLA_USER_TYPE;
  polla_group_id: string | null;
}): PollaPrizeScope | null => {
  if (!canSeePollaPage(user.user_type, 'PRIZES')) return null;

  switch (user.user_type) {
    case POLLA_USER_TYPE.ADMIN:
      // Un admin sin grupo no ve nada (la API ya lo frena antes).
      return user.polla_group_id ? { groupId: user.polla_group_id, seesPaid: true } : null;
    case POLLA_USER_TYPE.CASHIER:
      return { cashierId: user.polla_user_id, seesPaid: true };
    case POLLA_USER_TYPE.PLAYER:
      return { userId: user.polla_user_id, seesPaid: false };
    default:
      return { seesPaid: true };
  }
};
