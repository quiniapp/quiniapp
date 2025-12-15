export enum USER_TYPE {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
  SUPERADMIN = 'SUPERADMIN',
}

export enum CASHIER_TYPE {
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
  group_id?: string | null;
  last_name?: string | null;
  address?: string | null;
  phone?: number | null;
  email?: string | null;
  disabled: boolean;
  created_at: string | Date;
  edited_at: string | Date;
  deleted_at: string | null | Date;
}

// Usuario tipo OWNER o ADMIN
export interface OwnerOrAdminUserEntityBack extends BaseUserEntityBack {
  user_type: USER_TYPE.OWNER | USER_TYPE.ADMIN | USER_TYPE.SUPERADMIN;
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

// Usuario tipo OWNER o ADMIN
export interface OwnerOrAdminUserEntityFront extends IBaseUserEntityFront {
  user_type: USER_TYPE.OWNER | USER_TYPE.ADMIN | USER_TYPE.SUPERADMIN;
  group_id?: string | null;
}

// Usuario tipo CASHIER
export interface CashierUserEntityFront extends IBaseUserEntityFront {
  user_type: USER_TYPE.CASHIER;
  group_id?: string | null;
  cashier_type: CASHIER_TYPE;
  fee: number;
  fee_plus: number;
}

export type IUserEntityFront = OwnerOrAdminUserEntityFront | CashierUserEntityFront;
