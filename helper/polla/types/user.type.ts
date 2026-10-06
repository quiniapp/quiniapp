/* eslint-disable no-unused-vars */
/**
 * Jerarquía de la Polla. Cada nivel ve y administra a los de abajo.
 * PLAYER es el rol nuevo respecto de QuiniApp: cuelga de un CASHIER y sus
 * jugadas se imputan a la cuenta corriente de ese pasador, que las cobra por
 * fuera de la aplicación.
 */
export enum POLLA_USER_TYPE {
  OWNER = 'OWNER',
  CAPITALIST = 'CAPITALIST',
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
  PLAYER = 'PLAYER',
}

/** Tema visual que elige cada usuario desde Configuración. */
export enum POLLA_THEME {
  LIGHT = 'light',
  DARK = 'dark',
}
/* eslint-enable no-unused-vars */

/** Nombre de cada rol tal como se muestra en pantalla. */
export const POLLA_USER_TYPE_LABEL: Record<POLLA_USER_TYPE, string> = {
  [POLLA_USER_TYPE.OWNER]: 'Dueño',
  [POLLA_USER_TYPE.CAPITALIST]: 'Capitalista',
  [POLLA_USER_TYPE.SUPERADMIN]: 'Superadministrador',
  [POLLA_USER_TYPE.ADMIN]: 'Administrador',
  [POLLA_USER_TYPE.CASHIER]: 'Pasador',
  [POLLA_USER_TYPE.PLAYER]: 'Jugador',
};

/** Menor número = más privilegios. */
export const POLLA_USER_HIERARCHY: Record<POLLA_USER_TYPE, number> = {
  [POLLA_USER_TYPE.OWNER]: 0,
  [POLLA_USER_TYPE.CAPITALIST]: 1,
  [POLLA_USER_TYPE.SUPERADMIN]: 2,
  [POLLA_USER_TYPE.ADMIN]: 3,
  [POLLA_USER_TYPE.CASHIER]: 4,
  [POLLA_USER_TYPE.PLAYER]: 5,
};

/** Roles que administran la operación (cargan resultados, liquidan, editan pasado el límite). */
export const POLLA_ADMIN_ROLES: POLLA_USER_TYPE[] = [
  POLLA_USER_TYPE.OWNER,
  POLLA_USER_TYPE.CAPITALIST,
  POLLA_USER_TYPE.SUPERADMIN,
  POLLA_USER_TYPE.ADMIN,
];

/** Roles que pueden filtrar y ver los datos completos de las jugadas ajenas. */
export const POLLA_STAFF_ROLES: POLLA_USER_TYPE[] = [...POLLA_ADMIN_ROLES, POLLA_USER_TYPE.CASHIER];

export const isPollaAdminRole = (role: POLLA_USER_TYPE): boolean =>
  POLLA_ADMIN_ROLES.includes(role);

export const isPollaStaffRole = (role: POLLA_USER_TYPE): boolean =>
  POLLA_STAFF_ROLES.includes(role);

export interface IPollaUserEntityBack {
  polla_user_id: string;
  number: number | null;
  user_type: POLLA_USER_TYPE;
  name: string;
  last_name: string | null;
  phone: number | null;
  email: string | null;
  username: string | null;
  password_hash: string | null;
  password_changed_at: string | null;
  password_reset_required: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  polla_organization_id: string;
  polla_group_id: string | null;
  parent_polla_user_id: string | null;
  fee: number | null;
  fee_plus: number | null;
  /** Sin uso: las jugadas ya no se pagan con créditos. Queda por el historial. */
  credit_balance: number;
  theme: POLLA_THEME;
  disabled: boolean;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type IPollaUserEntityFront = Omit<
  IPollaUserEntityBack,
  | 'password_hash'
  | 'password_changed_at'
  | 'failed_login_attempts'
  | 'last_login_ip'
  | 'deleted_at'
  | 'credit_balance'
>;

/** Usuario encontrado por número para cargarle una jugada a su nombre. */
export interface IPollaUserByNumber {
  polla_user_id: string;
  name: string;
  last_name: string | null;
  number: number;
  user_type: POLLA_USER_TYPE;
  /** Pasador del jugador; para un pasador, él mismo. */
  cashier_name: string;
}

/** Usuario autenticado tal como lo devuelve /auth/validate. */
export interface IPollaSessionUser {
  polla_user_id: string;
  name: string;
  last_name: string | null;
  username: string | null;
  number: number | null;
  user_type: POLLA_USER_TYPE;
  polla_organization_id: string;
  polla_group_id: string | null;
  parent_polla_user_id: string | null;
  password_reset_required: boolean;
  theme: POLLA_THEME;
}
