import { IUserEntityBack } from '../types/user.type';

export type INewUserEntity = Omit<
  IUserEntityBack,
  'user_id' | 'disabled' | 'created_at' | 'edited_at' | 'deleted_at'
> & {
  password: string;
};

export type IUpdateUserEntity = Partial<Omit<IUserEntityBack, 'user_id'>>;
export type IDelenteUserEntity = Pick<IUserEntityBack, 'user_id'>;
export type IGetUserEntity = Partial<
  Pick<IUserEntityBack, 'user_id' | 'username' | 'number' | 'name'>
>;