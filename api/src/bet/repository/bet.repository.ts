import { supabase } from '../../../database/db.connection';

export class BetRepository {
  async getById(id: string) {
    const { data, error } = await supabase.from('bet').select('*').eq('id', id).single();

    if (error) throw error;
    return data;
  }

  async getAll() {
    const { data, error } = await supabase.from('bet').select('*');

    if (error) throw error;
    return data;
  }

  async create(payload: any) {
    const { data, error } = await supabase.from('bet').insert(payload).select().single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: any) {
    const { data, error } = await supabase
      .from('bet')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase.from('bet').delete().eq('id', id);

    if (error) throw error;
  }
}
