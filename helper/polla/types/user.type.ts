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
  /**
   * "Super": asistente de carga de toda la organización. Carga jugadas a
   * nombre de pasadores o jugadores, las ve y las administra (con el corte del
   * admin); nada más.
   */
  ASSISTANT = 'ASSISTANT',
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
  [POLLA_USER_TYPE.ASSISTANT]: 'Super',
  [POLLA_USER_TYPE.ADMIN]: 'Administrador',
  [POLLA_USER_TYPE.CASHIER]: 'Pasador',
  [POLLA_USER_TYPE.PLAYER]: 'Jugador',
};

/** Menor número = más privilegios. */
export const POLLA_USER_HIERARCHY: Record<POLLA_USER_TYPE, number> = {
  [POLLA_USER_TYPE.OWNER]: 0,
  [POLLA_USER_TYPE.CAPITALIST]: 1,
  [POLLA_USER_TYPE.SUPERADMIN]: 2,
  [POLLA_USER_TYPE.ASSISTANT]: 3,
  [POLLA_USER_TYPE.ADMIN]: 4,
  [POLLA_USER_TYPE.CASHIER]: 5,
  [POLLA_USER_TYPE.PLAYER]: 6,
};

/**
 * Roles de toda la organización: ediciones, quinielas, turnos, resultados,
 * grupos y cuenta corriente. Cargan sin corte hasta el último día de juego.
 */
export const POLLA_SUPER_ROLES: POLLA_USER_TYPE[] = [
  POLLA_USER_TYPE.OWNER,
  POLLA_USER_TYPE.CAPITALIST,
  POLLA_USER_TYPE.SUPERADMIN,
];

/**
 * Roles que cargan a nombre de otros y repiten sin cargo. El ADMIN lo hace
 * solo dentro de su grupo; los `POLLA_SUPER_ROLES`, en toda la organización.
 */
export const POLLA_ADMIN_ROLES: POLLA_USER_TYPE[] = [...POLLA_SUPER_ROLES, POLLA_USER_TYPE.ADMIN];

/**
 * Roles que cargan y administran jugadas a nombre de pasadores y jugadores:
 * los `POLLA_ADMIN_ROLES` y el Super (ASSISTANT), que lo hace en toda la
 * organización pero no repite sin cargo.
 */
export const POLLA_LOADER_ROLES: POLLA_USER_TYPE[] = [
  ...POLLA_ADMIN_ROLES,
  POLLA_USER_TYPE.ASSISTANT,
];

/** Roles que pueden filtrar y ver los datos completos de las jugadas ajenas. */
export const POLLA_STAFF_ROLES: POLLA_USER_TYPE[] = [
  ...POLLA_LOADER_ROLES,
  POLLA_USER_TYPE.CASHIER,
];

export const isPollaSuperRole = (role: POLLA_USER_TYPE): boolean =>
  POLLA_SUPER_ROLES.includes(role);

export const isPollaAdminRole = (role: POLLA_USER_TYPE): boolean =>
  POLLA_ADMIN_ROLES.includes(role);

export const isPollaLoaderRole = (role: POLLA_USER_TYPE): boolean =>
  POLLA_LOADER_ROLES.includes(role);

export const isPollaStaffRole = (role: POLLA_USER_TYPE): boolean =>
  POLLA_STAFF_ROLES.includes(role);

/**
 * Roles que ven la cuenta corriente de los pasadores, sus reportes y gastos, y
 * liquidan (pasadores y grupos). El ADMIN ve solo la cuenta de su grupo; el
 * pasador, solo la suya.
 */
export const POLLA_ACCOUNT_ROLES: POLLA_USER_TYPE[] = POLLA_SUPER_ROLES;

/**
 * Tipos que lista la pantalla de Usuarios para cada rol: los inferiores, sin el
 * capitalista, que se ve y se administra solo desde Organizaciones.
 */
export const pollaUserListTypes = (role: POLLA_USER_TYPE): POLLA_USER_TYPE[] =>
  Object.values(POLLA_USER_TYPE).filter(
    (type) =>
      type !== POLLA_USER_TYPE.CAPITALIST && POLLA_USER_HIERARCHY[type] > POLLA_USER_HIERARCHY[role]
  );

/**
 * Qué tipos de usuario da de alta cada rol desde Usuarios, siempre dentro de
 * su organización. El capitalista se crea únicamente junto con su
 * organización y el admin, junto con su grupo (Grupos). El superadmin lo crean
 * el capitalista y el dueño; el Super, ellos y el superadmin. El admin crea
 * pasadores y jugadores de su grupo; el pasador, sus jugadores.
 */
export const POLLA_CREATABLE_TYPES: Record<POLLA_USER_TYPE, POLLA_USER_TYPE[]> = {
  [POLLA_USER_TYPE.OWNER]: [
    POLLA_USER_TYPE.SUPERADMIN,
    POLLA_USER_TYPE.ASSISTANT,
    POLLA_USER_TYPE.CASHIER,
    POLLA_USER_TYPE.PLAYER,
  ],
  [POLLA_USER_TYPE.CAPITALIST]: [
    POLLA_USER_TYPE.SUPERADMIN,
    POLLA_USER_TYPE.ASSISTANT,
    POLLA_USER_TYPE.CASHIER,
    POLLA_USER_TYPE.PLAYER,
  ],
  [POLLA_USER_TYPE.SUPERADMIN]: [
    POLLA_USER_TYPE.ASSISTANT,
    POLLA_USER_TYPE.CASHIER,
    POLLA_USER_TYPE.PLAYER,
  ],
  [POLLA_USER_TYPE.ASSISTANT]: [],
  [POLLA_USER_TYPE.ADMIN]: [POLLA_USER_TYPE.CASHIER, POLLA_USER_TYPE.PLAYER],
  [POLLA_USER_TYPE.CASHIER]: [POLLA_USER_TYPE.PLAYER],
  [POLLA_USER_TYPE.PLAYER]: [],
};

/**
 * A quién le blanquea la contraseña cada rol. Nadie se la cambia a sí mismo:
 * siempre la pone un superior. El OWNER llega a los capitalistas de todas las
 * organizaciones (desde Organizaciones) y al resto solo dentro de la suya. El
 * admin, solo dentro de su grupo.
 */
export const POLLA_PASSWORD_RESET_TARGETS: Record<POLLA_USER_TYPE, POLLA_USER_TYPE[]> = {
  [POLLA_USER_TYPE.OWNER]: [
    POLLA_USER_TYPE.CAPITALIST,
    POLLA_USER_TYPE.SUPERADMIN,
    POLLA_USER_TYPE.ASSISTANT,
    POLLA_USER_TYPE.ADMIN,
    POLLA_USER_TYPE.CASHIER,
    POLLA_USER_TYPE.PLAYER,
  ],
  [POLLA_USER_TYPE.CAPITALIST]: [
    POLLA_USER_TYPE.SUPERADMIN,
    POLLA_USER_TYPE.ASSISTANT,
    POLLA_USER_TYPE.ADMIN,
    POLLA_USER_TYPE.CASHIER,
    POLLA_USER_TYPE.PLAYER,
  ],
  [POLLA_USER_TYPE.SUPERADMIN]: [
    POLLA_USER_TYPE.ASSISTANT,
    POLLA_USER_TYPE.ADMIN,
    POLLA_USER_TYPE.CASHIER,
    POLLA_USER_TYPE.PLAYER,
  ],
  [POLLA_USER_TYPE.ASSISTANT]: [],
  [POLLA_USER_TYPE.ADMIN]: [POLLA_USER_TYPE.CASHIER, POLLA_USER_TYPE.PLAYER],
  [POLLA_USER_TYPE.CASHIER]: [POLLA_USER_TYPE.PLAYER],
  [POLLA_USER_TYPE.PLAYER]: [],
};

/** Solo pasadores y jugadores pueden ser de calle (sin usuario ni contraseña). */
export const canBePollaStreetUser = (type: POLLA_USER_TYPE | ''): boolean =>
  type === POLLA_USER_TYPE.CASHIER || type === POLLA_USER_TYPE.PLAYER;

/**
 * Código con que se muestra a un pasador: `{grupo}-{número}` (grupo 0 = sin
 * grupo). Los números de pasador se repiten entre grupos.
 */
export const pollaCashierCode = (
  groupNumber: number | null | undefined,
  number: number | null | undefined
): string => (number ? `${groupNumber ?? 0}-${number}` : '');

export const canCreatePollaUser = (actor: POLLA_USER_TYPE, target: POLLA_USER_TYPE): boolean =>
  POLLA_CREATABLE_TYPES[actor].includes(target);

export const canResetPollaPassword = (actor: POLLA_USER_TYPE, target: POLLA_USER_TYPE): boolean =>
  POLLA_PASSWORD_RESET_TARGETS[actor].includes(target);

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
  /** De calle: sin usuario ni contraseña, no entra (solo pasadores y jugadores). */
  is_street: boolean;
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

/**
 * Resultado del buscador de pasadores y jugadores (por número exacto o por
 * nombre, apellido y usuario). `cashier_*` es el pasador del jugador; para un
 * pasador, él mismo.
 */
export interface IPollaUserOption extends IPollaUserByNumber {
  username: string | null;
  cashier_number: number | null;
  /** Número del grupo (del pasador, o del pasador del jugador); `null` = sin grupo. */
  group_number: number | null;
  is_street: boolean;
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
