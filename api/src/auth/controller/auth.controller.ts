// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { ERROR_MESSAGE } from '@helper/types/errors.type';
import { IUserEntityBack, IUserEntityFront } from '@helper/types/user.type';
import { AuthRepository } from '../repository/auth.repository';
import { IAuthLogin } from '@helper/types/auth.type';
import bcrypt from 'bcryptjs';
import { parseUser } from 'api/src/user/helper/parseUser';
export class AuthController {
  private repository = new AuthRepository();

  login = async (props: IAuthLogin): Promise<IUserEntityFront> => {
    try {
      console.log('controller');
      const user: IUserEntityBack = await this.repository.login({ ...props });
      console.log(user);
      // 👇 Comparamos el password ingresado con el guardado
      if (user.password) {
        const isPasswordValid = await bcrypt.compare(props.password, user.password);

        if (!isPasswordValid) {
          throw new Error(ERROR_MESSAGE.INVALID_CREDENTIALS);
        }
      }
      return parseUser(user);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Login error:', error.message);

        throw error; // o volver a lanzar para que la capa superior lo maneje
      }
      throw new Error('Unknown error during login');
    }
  };

  logout = (req: Request, res: Response) => {
    // TODO: Invalidar token o limpiar sesión
    res.status(200).json({ message: 'Logout endpoint' });
  };
}
