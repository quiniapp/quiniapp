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

      if (!data) throw new Error(ERROR_MESSAGE.USER_NOT_FOUND);

      return data;
    } catch (error) {
      console.error(error);
      throw new Error(ERROR_MESSAGE.INTERNAL_SERVER_ERROR);
    }
  }
}
