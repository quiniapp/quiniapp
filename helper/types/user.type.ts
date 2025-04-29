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
  user_id: string;
  number: number | null;
  user_type: USER_TYPE;
  name?: string;
  last_name?: string;
  address?: string;
  phone?: number;
  email?: string;
  username: string;
  password: string;
  user_salt: string;
  token: string;
  refresh_token:string;
  disabled: boolean;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

// Usuario tipo OWNER o ADMIN
export interface OwnerOrAdminUserEntityBack extends BaseUserEntityBack {
  user_type: USER_TYPE.OWNER | USER_TYPE.ADMIN;
  group_id: string | null;
  cashier_number: null;
  cashier_type: null;
  fee?: null;
  fee_plus?: null;
}

// Usuario tipo CASHIER
export interface CashierUserEntityBack extends BaseUserEntityBack {
  user_type: USER_TYPE.CASHIER;
  group_id: string;
  cashier_number: number;
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
  cashier_number?: null;
  cashier_type?: null;
  fee?: null;
  fee_plus?: null;
}

// Usuario tipo CASHIER
export interface CashierUserEntityFront extends IBaseUserEntityFront {
  user_type: USER_TYPE.CASHIER;
  group_id: string;
  cashier_number: number;
  cashier_type: CASHIER_TYPE;
  fee: number;
  fee_plus: number;
}

export type IUserEntityFront = OwnerOrAdminUserEntityFront | CashierUserEntityFront;
