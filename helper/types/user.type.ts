/* eslint-disable no-unused-vars */
// User hierarchy: OWNER -> CAPITALIST -> SUPERADMIN -> ADMIN -> CASHIER
export enum USER_TYPE {
  OWNER = 'OWNER',
  CAPITALIST = 'CAPITALIST',
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
}

export enum CASHIER_TYPE {
  PC = 'PC',
  STREET = 'STREET',
}
/* eslint-enable no-unused-vars */
interface BaseUserEntityBack {
  user_id: string;
  number: number | null;
  user_type: USER_TYPE;
  name: string;
  organization_id: string;
  group_id: string | null;
  username?: string | null;
  last_name?: string | null;
  address?: string | null;
  phone?: number | null;
  email?: string | null;
  disabled: boolean;
  created_at: string | Date;
  edited_at: string | Date;
  deleted_at: string | null | Date;

  // Custom authentication fields (Phase 5)
  password_hash?: string | null;
  password_changed_at?: string | Date | null;
  password_reset_required?: boolean;
  failed_login_attempts?: number;
  locked_until?: string | Date | null;
  last_login_at?: string | Date | null;
  last_login_ip?: string | null;
}

// Usuario tipo OWNER, CAPITALIST, SUPERADMIN o ADMIN (no-cashier users)
export interface OwnerOrAdminUserEntityBack extends BaseUserEntityBack {
  user_type: USER_TYPE.OWNER | USER_TYPE.CAPITALIST | USER_TYPE.SUPERADMIN | USER_TYPE.ADMIN;
  cashier_type: null;
  fee: null;
  fee_plus: null;
}

// Usuario tipo CASHIER
export interface CashierUserEntityBack extends BaseUserEntityBack {
  user_type: USER_TYPE.CASHIER;
  cashier_type: CASHIER_TYPE;
  fee: number;
  fee_plus: number;
}

// Unión de todos los tipos posibles
export type IUserEntityBack = OwnerOrAdminUserEntityBack | CashierUserEntityBack;

export type IBaseUserEntityFront = Omit<
  BaseUserEntityBack,
  'created_at' | 'deleted_at' | 'edited_at' | 'organization_id'
>;

// Usuario tipo OWNER, CAPITALIST, SUPERADMIN o ADMIN (no-cashier users)
export interface OwnerOrAdminUserEntityFront extends IBaseUserEntityFront {
  user_type: USER_TYPE.OWNER | USER_TYPE.CAPITALIST | USER_TYPE.SUPERADMIN | USER_TYPE.ADMIN;
}

// Usuario tipo CASHIER
export interface CashierUserEntityFront extends IBaseUserEntityFront {
  user_type: USER_TYPE.CASHIER;
  cashier_type: CASHIER_TYPE;
  fee: number;
  fee_plus: number;
}

export type IUserEntityFront = OwnerOrAdminUserEntityFront | CashierUserEntityFront;

// ============= Session Types =============

/**
 * Last session information (simplified for frontend)
 * Only the most recent session's last_activity_at
 */
export interface ILastSessionInfo {
  last_activity_at: string | Date;
}

/**
 * User with last session information
 * Used when fetching users with include_session=true
 * Only includes the most recent session's activity time
 */
export type IUserWithSessionFront = IUserEntityFront & {
  last_session?: ILastSessionInfo;
};
