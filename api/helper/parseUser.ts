import {
  IBaseUserEntityFront,
  IUserEntityBack,
  IUserEntityFront,
  USER_TYPE,
} from '@helper/types/user.type';

export const parseUser = (user: IUserEntityBack): IUserEntityFront => {
  const baseUser: IBaseUserEntityFront = {
    user_id: user.user_id,
    number: user.number,
    user_type: user.user_type,
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
      ...baseUser,
      user_type: USER_TYPE.CASHIER,
      group_id: user.group_id,
      cashier_number: user.cashier_number,
      cashier_type: user.cashier_type,
      fee: user.fee,
      fee_plus: user.fee_plus,
    };
  }

  return {
    ...baseUser,
    user_type: user.user_type, // OWNER o ADMIN
    group_id: user.group_id,
    cashier_number: null,
    cashier_type: null,
    fee: null,
    fee_plus: null,
  };
};
