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

  async getUserByRefreshToken(tokenPayload: { user_id: string; username: string }) {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', tokenPayload.user_id)
        .eq('username', tokenPayload.username)
        .single();

      if (!data) throw new Error(ERROR_MESSAGE.USER_NOT_FOUND);
      return data;
    } catch (error) {
      console.error(error);
      throw new Error(ERROR_MESSAGE.INTERNAL_SERVER_ERROR);
    }
  }
  async updateTokens(user_id: string, accessToken: string, refreshToken: string) {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          token: accessToken,
          refresh_token: refreshToken,
          edited_at: new Date().toISOString(),
        })
        .eq('user_id', user_id);

      if (error) throw error;
    } catch (error) {
      console.error(error);
      throw new Error(ERROR_MESSAGE.INTERNAL_SERVER_ERROR);
    }
  }
}
