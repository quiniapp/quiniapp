import { IUpdateUserEntity } from '@helper/request/user.response';
import { IUserEntityBack } from '@helper/types/user.type';
import { supabase } from 'api/database/db.connection';

export class UserRepository {
  async getById(id: string) {
    const { data, error } = await supabase.from('users').select('*').eq('user_id', id).single();

    if (error) throw error;
    return data;
  }

  async getAll() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data;
  }

  async create(newUser: IUserEntityBack) {
    const { data, error } = await supabase.from('users').insert(newUser).select().single();
    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, payload: IUpdateUserEntity) {
    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase.from('users').delete().eq('id', id);

    if (error) throw error;
  }
}
