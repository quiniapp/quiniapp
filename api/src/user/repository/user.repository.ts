import { IUserEntityBack } from 'helper/types/user.type';
import { supabase } from 'api/database/db.connection';
import dayjs from 'dayjs';

export class UserRepository {
  async getById(id: string) {
    const { data, error } = await supabase.from('users').select('*').eq('user_id', id).single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll(cashier_number?: number) {
    let query = supabase.from('users').select('*');

    if (cashier_number) {
      query = query.eq('number', cashier_number);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.details);
    return data;
  }
  async create(newUser: IUserEntityBack) {
    const { data, error } = await supabase.from('users').insert(newUser).select().single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: any) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({ ...payload, edited_at: timestamp })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async delete(id: string) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({ deleted_at: timestamp })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.details);
    return data;
  }
}
