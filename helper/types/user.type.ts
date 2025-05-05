export enum USER_TYPE {
  OWNER,
  ADMIN,
  CASHIER,
}

export enum CASHIER_TYPE {
  PC,
  STREET,
}

// Base común para todos los usuarios
interface BaseUserEntityBack {
  user_id?: string;
  number: number;
  user_type: USER_TYPE;
  name: string;
  last_name?: string | null;
  address?: string | null;
  phone?: number | null;
  email?: string | null;
  username?: string | null;
  password?: string | null;
  user_salt?: string | null;
  token?: string | null;
  refresh_token?: string | null;
  disabled: boolean;
  created_at: string | Date;
  edited_at: string | Date;
  deleted_at: string | null | Date;
}

// Usuario tipo OWNER o ADMIN
export interface OwnerOrAdminUserEntityBack extends BaseUserEntityBack {
  user_type: USER_TYPE.OWNER | USER_TYPE.ADMIN;
  group_id: string | null;
  cashier_type: null;
  fee: null;
  fee_plus: null;
}

// Usuario tipo CASHIER
export interface CashierUserEntityBack extends BaseUserEntityBack {
  user_type: USER_TYPE.CASHIER;
  group_id: string | null;
  cashier_type: CASHIER_TYPE;
  fee: number;
  fee_plus: number;
}

// Unión de todos los tipos posibles
export type IUserEntityBack = OwnerOrAdminUserEntityBack | CashierUserEntityBack;

export type IBaseUserEntityFront = Omit<
  BaseUserEntityBack,
  'password' | 'user_salt' | 'created_at' | 'deleted_at' | 'edited_at' | 'refresh_token'
>;

// Usuario tipo OWNER o ADMIN
export interface OwnerOrAdminUserEntityFront extends IBaseUserEntityFront {
  user_type: USER_TYPE.OWNER | USER_TYPE.ADMIN;
  group_id: string | null;
}

// Usuario tipo CASHIER
export interface CashierUserEntityFront extends IBaseUserEntityFront {
  user_type: USER_TYPE.CASHIER;
  group_id: string | null;
  cashier_type: CASHIER_TYPE;
  fee: number;
  fee_plus: number;
}

export type IUserEntityFront = OwnerOrAdminUserEntityFront | CashierUserEntityFront;
