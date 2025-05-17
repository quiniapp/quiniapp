import { USER_TYPE } from '@helper/types/user.type';
import { supabase } from '../../../database/db.connection';
import dayjs from 'dayjs';

export class ResultsRepository {
  async getById(id: string) {
    const { data, error } = await supabase.from('results').select('*').eq('id', id).single();

    if (error) throw new Error(error.details);
    return data;
  }
  async get(id: string) {
    const { data, error } = await supabase.from('results').select('*').eq('id', id).single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll(user_type: USER_TYPE) {
    let query = supabase.from('results').select('*').order('time', { ascending: true });

    if (user_type === USER_TYPE.CASHIER) {
      const now = dayjs().format('HH:mm:ss'); // ej. "13:45:00"
      query = query.gt('time', now);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.details);
    return data;
  }

  async create(payload: any) {
    const { data, error } = await supabase.from('results').insert(payload).select().single();

    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, payload: any) {
    const { data, error } = await supabase
      .from('results')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }
}
