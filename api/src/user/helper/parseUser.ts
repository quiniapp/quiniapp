import { IUserEntityBack, IUserEntityFront, USER_TYPE } from '@helper/types/user.type';

export const parseUser = (user: IUserEntityBack): IUserEntityFront => {
  const base = {
    user_id: user.user_id,
    number: user.number,
    name: user.name,
    last_name: user.last_name,
    address: user.address,
    phone: user.phone,
    email: user.email,
    username: user.username,
    token: user.token,
    disabled: user.disabled,
  };

  if (user.user_type === USER_TYPE.CASHIER) {
    return {
      ...base,
      group_id: user.group_id,
      user_type: USER_TYPE.CASHIER,
      cashier_type: user.cashier_type,
      fee: user.fee,
      fee_plus: user.fee_plus,
    };
  }

  // Para OWNER o ADMIN
  return {
    ...base,
    user_type: user.user_type,
    group_id: user.group_id,
  };
};
