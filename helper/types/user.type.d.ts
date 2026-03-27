export declare enum USER_TYPE {
  OWNER = 'OWNER',
  CAPITALIST = 'CAPITALIST',
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
}
export declare enum CASHIER_TYPE {
  PC = 'PC',
  STREET = 'STREET',
}
interface BaseUserEntityBack {
  user_id: string;
  number: number | null;
  user_type: USER_TYPE;
  name: string;
  organization_id: string;
  username?: string | null;
  last_name?: string | null;
  address?: string | null;
  phone?: number | null;
  email?: string | null;
  disabled: boolean;
  created_at: string | Date;
  edited_at: string | Date;
  deleted_at: string | null | Date;
  password_hash?: string | null;
  password_changed_at?: string | Date | null;
  password_reset_required?: boolean;
  failed_login_attempts?: number;
  locked_until?: string | Date | null;
  last_login_at?: string | Date | null;
  last_login_ip?: string | null;
}
export interface OwnerOrAdminUserEntityBack extends BaseUserEntityBack {
  user_type: USER_TYPE.OWNER | USER_TYPE.CAPITALIST | USER_TYPE.SUPERADMIN | USER_TYPE.ADMIN;
  cashier_type: null;
  fee: null;
  fee_plus: null;
}
export interface CashierUserEntityBack extends BaseUserEntityBack {
  user_type: USER_TYPE.CASHIER;
  cashier_type: CASHIER_TYPE;
  fee: number;
  fee_plus: number;
}
export type IUserEntityBack = OwnerOrAdminUserEntityBack | CashierUserEntityBack;
export type IBaseUserEntityFront = Omit<
  BaseUserEntityBack,
  'created_at' | 'deleted_at' | 'edited_at' | 'organization_id'
>;
export interface OwnerOrAdminUserEntityFront extends IBaseUserEntityFront {
  user_type: USER_TYPE.OWNER | USER_TYPE.CAPITALIST | USER_TYPE.SUPERADMIN | USER_TYPE.ADMIN;
}
export interface CashierUserEntityFront extends IBaseUserEntityFront {
  user_type: USER_TYPE.CASHIER;
  cashier_type: CASHIER_TYPE;
  fee: number;
  fee_plus: number;
}
export type IUserEntityFront = OwnerOrAdminUserEntityFront | CashierUserEntityFront;
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
export {};
