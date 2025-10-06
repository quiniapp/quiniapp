import { CASHIER_TYPE, USER_TYPE } from '../../../@helper/types/user.type.ts';

export interface AddNewUserFormValues {
  pinNumber: string;
  pinType?: string;
  group?: string;
  name: string;
  lastName: string;
  address?: string;
  phone?: string;
  email?: string;
  user: string;
  password: string;
  commission?: number;
  spread?: number;
}

export interface Users {
  address: string;
  disabled: boolean;
  email: string;
  group_id: string;
  last_name: string;
  name: string;
  number: number;
  phone: string;
  user_id: string;
  user_type: USER_TYPE;
  username: string;
  fee: number;
  fee_plus: number;
  account?: string;
}

export interface INewUserEntityForm {
  number: number;
  name: string;
  user_type?: USER_TYPE;
  cashier_type?: CASHIER_TYPE;
  fee?: number;
  fee_plus?: number;
  username?: string;
  password?: string;
  group_id?: string;
  last_name?: string;
  address?: string;
  phone?: number;
  email?: string;
}
