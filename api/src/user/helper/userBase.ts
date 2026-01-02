import { v4 as uuidv4 } from 'uuid';
import { INewUserEntity } from '@helper/request/user.request';
import { CASHIER_TYPE, IUserEntityBack, USER_TYPE } from '@helper/types/user.type';
import dayjs from 'dayjs';
import { generateEmail } from 'api/helper/generateEmail';
import { hashPassword } from 'api/helper/password';

const getBaseUserFields = (user: INewUserEntity, organization_id: string) => {
  const timestamp = dayjs().toISOString();

  // Determinar si el número debe ser null basado en el tipo de usuario
  // Hierarchy: OWNER, CAPITALIST, SUPERADMIN don't require number
  const shouldNumberBeNull =
    user.user_type === USER_TYPE.OWNER ||
    user.user_type === USER_TYPE.CAPITALIST ||
    user.user_type === USER_TYPE.SUPERADMIN;

  return {
    user_id: uuidv4(),
    number: shouldNumberBeNull ? null : (user.number ?? null),
    user_type: user.user_type,
    name: user.name,
    organization_id,
    last_name: user.last_name ?? null,
    address: user.address ?? null,
    phone: user.phone ?? null,
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

  // Validar que ADMIN y CASHIER tengan número
  if (
    (user.user_type === USER_TYPE.ADMIN || user.user_type === USER_TYPE.CASHIER) &&
    baseUser.number === null
  ) {
    throw new Error(`Number is required for ${user.user_type} users`);
  }

  // Determinar si el usuario necesita password (todos excepto STREET cashiers)
  const isStreetCashier = user?.cashier_type === CASHIER_TYPE.STREET;
  const needsPassword = !isStreetCashier;

  // Hash password para usuarios que lo necesitan
  let passwordHash: string | null = null;
  if (needsPassword) {
    if (!user.password) {
      throw new Error('Password is required for this user type');
    }
    passwordHash = await hashPassword(user.password);
  }

  return {
    ...baseUser,
    username: isStreetCashier ? null : user.username!,
    email: isStreetCashier ? null : generateEmail(user.username!),
    // Custom authentication fields
    password_hash: passwordHash,
    password_changed_at: needsPassword ? dayjs().toISOString() : null,
    password_reset_required: false, // Usuario puede hacer login inmediatamente
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    last_login_ip: null,
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
