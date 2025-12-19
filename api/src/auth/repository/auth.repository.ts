import { IAuthLogin } from '@helper/types/auth.type';
import { UnauthorizedError } from '@helper/errors';
import { supabase } from '@database/db.connection';

export class AuthRepository {
  async login(props: IAuthLogin) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', props.username)
      .is('deleted_at', null)
      .single();

    // Si hay error de Supabase o no hay datos, significa que el usuario no existe
    // Por seguridad, usar el mismo mensaje que cuando la contraseña es incorrecta
    if (error || !data) {
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    return data;
  }
}
