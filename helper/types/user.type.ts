export enum USER_TYPE {
  OWNER,
  ADMIN,
}

export interface IUserEntityBack {
  user_id: string;
  number: number | null;
  user_type: USER_TYPE;
  name?: string;
  last_name?: string;
  address?: string;
  phone?: number;
  email?: string;
  fee?: number;
  fee_plus?: number;
  username: string;
  password: string;
  user_salt: string;
  token: string;
  disabled: boolean;
  created_at: string;
  edited_at: string;
  deleted_at: string | null;
}

export type IBetEntityFront = Omit<
  IUserEntityBack,
  'password' | 'disabled' | 'user_salt' | 'created_at' | 'deleted_at' | 'edited_at'
>;
