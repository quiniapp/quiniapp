import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';

export class ScheduleRepository {
  async getById(id: string) {
    const { data, error } = await supabase
      .from('schedules')
      .select(
        `
    *,
    schedule_lotteries (
      day,
      lottery:lotteries (
        lottery_id,
        name,
        active
      )
    )
  `
      )
      .eq('id', id)
      .order('day', { referencedTable: 'schedule_lotteries', ascending: true }) // ordena las loterías por día
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll() {
    const { data, error } = await supabase
      .from('schedules')
      .select(
        `
    *,
    schedule_lotteries (
      day,
      lottery:lotteries (
        lottery_id,
        name,
        active
      )
    )
  `
      )
      .order('time', { ascending: true }) // ordena los schedules por hora
      .order('day', { referencedTable: 'schedule_lotteries', ascending: true }); // ordena las loterías por día

    if (error) throw new Error(error.details);
    return data;
  }

  async create(payload: any) {
    const { data, error } = await supabase.from('schedules').insert(payload).select().single();

    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, payload: any) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('schedules')
      .update({ ...payload, edited_at: timestamp })
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
