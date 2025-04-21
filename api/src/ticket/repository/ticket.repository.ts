import { supabase } from '../../../database/db.connection';

export class TicketRepository {
  async getById(id: string) {
    const { data, error } = await supabase.from('ticket').select('*').eq('id', id).single();

    if (error) throw error;
    return data;
  }

  async getAll() {
    const { data, error } = await supabase.from('ticket').select('*');

    if (error) throw error;
    return data;
  }

  async create(payload: any) {
    const { data, error } = await supabase.from('ticket').insert(payload).select().single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: any) {
    const { data, error } = await supabase
      .from('ticket')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase.from('ticket').delete().eq('id', id);

    if (error) throw error;
  }
}
