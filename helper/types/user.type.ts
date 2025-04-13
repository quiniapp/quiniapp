export enum USER_TYPE {
  OWNER,
  ADMIN,
  CASHIER,
}

export enum CASHIER_TYPE {
  PC,
  STREET,
}

export type IUserEntityFront = Pick<
  IUserEntityBack,
  'user_id' | 'name' | 'username' | 'number' | 'phone' | 'token' | 'user_type'
>;

export interface IUserEntityBack {
  user_id: string;
  number: number;
  user_type: USER_TYPE;
  cashier_type?: CASHIER_TYPE;
  name?: string;
  last_name?: string;
  address?: string;
  phone?: number;
  email?: string;
  fee: number;
  fee_plus: number;
  username: string;
  password: string;
  user_salt: string;
  token: string;
  disabled: boolean;
}
