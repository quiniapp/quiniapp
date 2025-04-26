// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { ERROR_MESSAGE } from '@helper/types/errors.type';
import {
  IBaseUserEntityFront,
  IUserEntityBack,
  IUserEntityFront,
  USER_TYPE,
} from '@helper/types/user.type';
import { AuthRepository } from '../repository/auth.repository';
import { IAuthLogin } from '@helper/types/auth.type';
import bcrypt from 'bcryptjs';
export class AuthController {
  private repository = new AuthRepository();

  login = async (props: IAuthLogin): Promise<IUserEntityFront> => {
    try {
      const user: IUserEntityBack = await this.repository.login({ ...props });
      // 👇 Comparamos el password ingresado con el guardado
      const isPasswordValid = await bcrypt.compare(props.password, user.password);

      if (!isPasswordValid) {
        throw new Error(ERROR_MESSAGE.INVALID_CREDENTIALS);
      }
      return parseUser(user);
    } catch (error) {
      throw new Error(String(error));
    }
  };

  logout = (req: Request, res: Response) => {
    // TODO: Invalidar token o limpiar sesión
    res.status(200).json({ message: 'Logout endpoint' });
  };
}

const parseUser = (user: IUserEntityBack): IUserEntityFront => {
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
