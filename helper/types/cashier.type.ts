export enum CASHIER_TYPE {
  PC,
  STREET,
}

export interface ICashierEntityBack {
  cashier_id: string;
  group_id: string;
  cashier_number: number;
  cashier_type: CASHIER_TYPE;
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
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type ICashierEntityFront = Omit<
  ICashierEntityBack,
  'created_at' | 'edited_at' | 'deleted_at'
>;
