import { USER_TYPE } from '@helper/types/user.type';
import { supabase } from '../../../database/db.connection';
import dayjs from 'dayjs';

export class ScheduleRepository {
  async getById(id: string) {
    const { data, error } = await supabase.from('schedules').select('*').eq('id', id).single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll(user_type: USER_TYPE) {
    let query = supabase.from('schedules').select('*').order('time', { ascending: true });

    if (user_type === USER_TYPE.CASHIER) {
      const now = dayjs().format('HH:mm:ss'); // ej. "13:45:00"
      query = query.gt('time', now);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.details);
    return data;
  }

  async create(payload: any) {
    const { data, error } = await supabase.from('schedules').insert(payload).select().single();

    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, payload: any) {
    const { data, error } = await supabase
      .from('schedules')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase.from('schedules').delete().eq('id', id);

    if (error) throw new Error(error.details);
    return;
  }
}
