import { supabase } from '../../../database/db.connection';

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

  async create(payload: any) {
    const { data, error } = await supabase.from('users').insert(payload).select().single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: any) {
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
