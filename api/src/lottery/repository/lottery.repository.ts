import { supabase } from '../../../database/db.connection';

export class LotteryRepository {
  async getById(id: string) {
    const { data, error } = await supabase.from('lottery').select('*').eq('id', id).single();

    if (error) throw error;
    return data;
  }

  async getAll() {
    const { data, error } = await supabase.from('lottery').select('*');

    if (error) throw error;
    return data;
  }

  async create(payload: any) {
    const { data, error } = await supabase.from('lottery').insert(payload).select().single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: any) {
    const { data, error } = await supabase
      .from('lottery')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase.from('lottery').delete().eq('id', id);

    if (error) throw error;
  }
}
