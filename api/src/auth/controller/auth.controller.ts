import { IUserEntityBack, IUserEntityFront } from '@helper/types/user.type';
import { AuthRepository } from '../repository/auth.repository';
import { IAuthLogin, IAuthLogout } from '@helper/types/auth.type';
import { parseUser } from 'api/src/user/helper/parseUser';
import { supabase } from 'api/database/db.connection';
import { generateEmail } from 'api/helper/generateEmail';
import { UnauthorizedError } from '@helper/errors';

export class AuthController {
  private repository = new AuthRepository();

  login = async (
    props: IAuthLogin
  ): Promise<{ user: IUserEntityFront; organization_id: string }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: generateEmail(props.username),
      password: props.password,
    });

    if (error) {
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    const userData: IUserEntityBack = await this.repository.login({ ...props });

    return {
      user: parseUser(userData),
      organization_id: userData.organization_id,
    };
  };

  logout = async (props: IAuthLogout) => {
    // TODO: Invalidar token o limpiar sesión
    const { error } = await supabase.auth.admin.signOut(props.token);

    if (error) {
      throw new UnauthorizedError('Error al cerrar sesión');
    }

    return true;
  };

  refresh = async () => {
    return;
  };
}
