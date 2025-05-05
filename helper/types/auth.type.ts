import { CASHIER_TYPE, USER_TYPE } from './user.type';

export interface IAuthLogin {
  username: string;
  password: string;
}

export interface ITokenPayload {
  cashier_type?: CASHIER_TYPE.STREET;
  user_id: string;
  user_type: USER_TYPE;
  username: string;
  name: string;
  number: number;
}
