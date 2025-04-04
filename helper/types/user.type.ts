export enum USER_TYPE {
  OWNER,
  ADMIN,
  CASHIER,
}

export type IUserEntityFront = Pick<
  IUserEntityBack,
  'user_id' | 'name' | 'username' | 'number' | 'phone' | 'token' | 'user_type'
>;

export interface IUserEntityBack {
  user_id: string;
  name: string;
  username?: string;
  number: number;
  phone: number;
  password: string;
  user_salt: string;
  token: string;
  user_type: USER_TYPE;
  disabled: boolean;
}
