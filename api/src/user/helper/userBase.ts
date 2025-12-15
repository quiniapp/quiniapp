import { v4 as uuidv4 } from 'uuid';
import { INewUserEntity } from '@helper/request/user.request';
import { CASHIER_TYPE, IUserEntityBack, USER_TYPE } from '@helper/types/user.type';
import dayjs from 'dayjs';
import { generateEmail } from 'api/helper/generateEmail';

const getBaseUserFields = (user: INewUserEntity, organization_id: string) => {
  const timestamp = dayjs().toISOString();

  return {
    user_id: uuidv4(),
    number: user.number,
    user_type: user.user_type,
    name: user.name,
    organization_id,
    last_name: user.last_name ?? null,
    address: user.address ?? null,
    phone: user.phone ?? null,
    group_id: user.group_id ? user.group_id : null,
    disabled: false,
    created_at: timestamp,
    edited_at: timestamp,
    deleted_at: null,
  };
};

export const buildUserForDB = async (
  user: INewUserEntity,
  organization_id: string
): Promise<IUserEntityBack> => {
  const baseUser = getBaseUserFields(user, organization_id);

  return {
    ...baseUser,
    username: user?.cashier_type === CASHIER_TYPE.STREET ? null : user.username!,
    email: user?.cashier_type === CASHIER_TYPE.STREET ? null : generateEmail(user.username!),
    ...(user?.user_type === USER_TYPE.CASHIER
      ? {
          user_type: USER_TYPE.CASHIER,
          cashier_type: user.cashier_type!,
          fee: user?.fee!,
          fee_plus: user?.fee_plus ?? 0,
        }
      : {
          user_type: user.user_type,
          cashier_type: null,
          fee: null,
          fee_plus: null,
        }),
  };
};
