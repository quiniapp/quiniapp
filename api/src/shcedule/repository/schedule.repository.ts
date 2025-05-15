import { supabase } from '../../../database/db.connection';

export class ScheduleRepository {
  async getById(id: string) {
    const { data, error } = await supabase.from('schedules').select('*').eq('id', id).single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll() {
    const { data, error } = await supabase.from('schedules').select('*');

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
