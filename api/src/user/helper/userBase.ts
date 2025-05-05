import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { INewUserEntity } from '@helper/request/user.response';
import { CASHIER_TYPE, IUserEntityBack, USER_TYPE } from '@helper/types/user.type';
import { JWT } from 'api/helper/JWT';
import dayjs from 'dayjs';
import { ITokenPayload } from '@helper/types/auth.type';

const SALT_ROUNDS = 10;

export const buildUserForDB = async (
  user: INewUserEntity
): Promise<IUserEntityBack | undefined> => {
  const user_id = uuidv4();
  const created_at = dayjs().toDate();
  const edited_at = created_at;
  const deleted_at = null;

  const user_salt = await bcrypt.genSalt(SALT_ROUNDS);
  const password = user.password ?? '';
  const hashedPassword = await bcrypt.hash(password, user_salt);

  const shouldGenerateToken = user?.cashier_type !== CASHIER_TYPE.STREET;

  const tokenPayload: ITokenPayload = {
    user_id,
    user_type: user.user_type,
    username: user.username ?? '',
    name: user.name,
    number: user.number,
    ...(user.cashier_type && { cashier_type: user.cashier_type }),
  };

  const token = shouldGenerateToken ? JWT.generateAccessToken(tokenPayload) : '';
  const refresh_token = shouldGenerateToken ? JWT.generateRefreshToken(tokenPayload) : '';

  const baseUser = {
    user_id,
    number: user.number ?? 0,
    user_type: user.user_type!,
    name: user.name ?? '',
    last_name: user.last_name ?? null,
    address: user.address ?? null,
    phone: user.phone ?? null,
    email: user.email ?? null,
    username: user.username ?? '',
    password: hashedPassword,
    user_salt,
    token,
    refresh_token,
    disabled: false,
    created_at,
    edited_at,
    deleted_at,
  };

  if (user.user_type === USER_TYPE.CASHIER && user.cashier_type) {
    return {
      ...baseUser,
      user_type: user.user_type,
      group_id: user.group_id ?? null,
      cashier_type: user.cashier_type,
      fee: user.fee ?? 0,
      fee_plus: user.fee_plus ?? 0,
    };
  }

  if (user.user_type === USER_TYPE.ADMIN)
    return {
      ...baseUser,
      user_type: user.user_type,
      group_id: user.group_id ?? null,
      cashier_type: null,
      fee: null,
      fee_plus: null,
    };
};
