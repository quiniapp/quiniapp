import { IUserEntityBack, IUserEntityFront } from 'helper/types/user.type';
import { AuthRepository } from '../repository/auth.repository';
import { IAuthLogin, IAuthLogout } from 'helper/types/auth.type';
import { parseUser } from 'api/src/user/helper/parseUser';
import { supabase } from 'api/database/db.connection';
import { generateEmail } from 'api/helper/generateEmail';
export class AuthController {
  private repository = new AuthRepository();

  login = async (props: IAuthLogin): Promise<IUserEntityFront> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: generateEmail(props.username),
        password: props.password,
      });
      if (error) {
        console.error(error);
        throw new Error(error.message);
      }
      const user: IUserEntityBack = await this.repository.login({ ...props });

      return parseUser(user);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Login error:', error.message);

        throw error; // o volver a lanzar para que la capa superior lo maneje
      }
      throw new Error('Unknown error during login');
    }
  };

  logout = async (props: IAuthLogout) => {
    // TODO: Invalidar token o limpiar sesión
    const { error } = await supabase.auth.admin.signOut(props.token);

    if (error) {
      console.error(error.message);
      throw new Error(error.message);
    }
    return true;
  };

  refresh = async (props: IAuthLogout) => {
    console.log(props);
    return;
  };
}
