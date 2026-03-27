import { INewUserEntity } from '@helper/request/user.request';
import { IUserEntityBack } from '@helper/types/user.type';
export declare const buildUserForDB: (
  user: INewUserEntity,
  organization_id: string
) => Promise<IUserEntityBack>;
