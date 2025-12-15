import { ICurrentAccountEntityBack } from '../types/current_account.type';
import { IUserEntityBack } from '../types/user.type';

export type IUpdateCurrentAccountEntity = Partial<
  Omit<
    ICurrentAccountEntityBack,
    'created_at' | 'edited_at' | 'current_account_id' | 'organization_id'
  >
>;

export type IGetAllCurrentAccountEntity = Pick<
  IUserEntityBack,
  'user_id' | 'user_type' | 'organization_id'
> &
  Partial<Pick<ICurrentAccountEntityBack, 'date'>>;

export type IGetCurrentAccountEntity = Pick<
  IUserEntityBack,
  'user_id' | 'user_type' | 'organization_id'
> &
  Partial<Pick<ICurrentAccountEntityBack, 'date'>>;
