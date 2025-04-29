import { IAuthLogin } from '@helper/types/auth.type';
import { ERROR_MESSAGE } from '@helper/types/errors.type';
import { supabase } from 'api/database/db.connection';

export class AuthRepository {
  async login(props: IAuthLogin) {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('username', props.username)
        .single();
      console.log('repo');
      if (!data) throw new Error(ERROR_MESSAGE.USER_NOT_FOUND);
      console.log(data);
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error; // Re-lanzamos el error original
      }
      throw new Error(ERROR_MESSAGE.INTERNAL_SERVER_ERROR);
    }
  }

  async logout() {}
}
