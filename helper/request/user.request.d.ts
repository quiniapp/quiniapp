import { IUserEntityBack } from '../types/user.type';
export type INewUserEntity = Omit<
  IUserEntityBack,
  | 'user_id'
  | 'disabled'
  | 'created_at'
  | 'edited_at'
  | 'deleted_at'
  | 'organization_id'
  | 'password_hash'
  | 'password_changed_at'
  | 'password_reset_required'
  | 'failed_login_attempts'
  | 'locked_until'
  | 'last_login_at'
  | 'last_login_ip'
> & {
  password: string;
};
export type IUpdateUserEntity = Pick<IUserEntityBack, 'user_id'> &
  Partial<
    Omit<
      IUserEntityBack,
      | 'user_id'
      | 'created_at'
      | 'edited_at'
      | 'deleted_at'
      | 'organization_id'
      | 'password_hash'
      | 'password_changed_at'
      | 'password_reset_required'
      | 'failed_login_attempts'
      | 'locked_until'
      | 'last_login_at'
      | 'last_login_ip'
    >
  >;
export type IDeleteUserEntity = Pick<IUserEntityBack, 'user_id'>;
export type IGetUserEntity = Partial<
  Pick<IUserEntityBack, 'user_id' | 'username' | 'number' | 'name'>
>;
