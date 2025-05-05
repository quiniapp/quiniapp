import { IUserEntityBack } from '../types/user.type';

export type INewUserEntity = Omit<
  IUserEntityBack,
  | 'user_id'
  | 'user_salt'
  | 'user_salt'
  | 'token'
  | 'refresh_token'
  | 'disabled'
  | 'created_at'
  | 'edited_at'
  | 'deleted_at'
>;
