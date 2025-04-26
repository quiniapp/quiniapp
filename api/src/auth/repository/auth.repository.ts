import { IAuthLogin } from '@helper/types/auth.type';
import { supabase } from 'api/database/db.connection';

export class AuthRepository {
  async login(props: IAuthLogin) {
    const { data, error } = await supabase
      .from('Users')
      .select('*')
      .eq('username', props.username)
      .single();

    if (error) throw error;
    return data;
  }

  async logout() {}
}
