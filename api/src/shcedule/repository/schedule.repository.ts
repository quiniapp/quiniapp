import { supabase } from '../../../database/db.connection';

export class ScheduleRepository {
  async getById(id: string) {
    const { data, error } = await supabase.from('shcedules').select('*').eq('id', id).single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll() {
    const { data, error } = await supabase.from('shcedules').select('*');

    if (error) throw new Error(error.details);
    return data;
  }

  async create(payload: any) {
    const { data, error } = await supabase.from('shcedules').insert(payload).select().single();

    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, payload: any) {
    const { data, error } = await supabase
      .from('shcedules')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase.from('shcedules').delete().eq('id', id);

    if (error) throw new Error(error.details);
    return;
  }
}
