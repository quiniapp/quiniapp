import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';

export class ScheduleRepository {
  async getById(id: string, organization_id: string) {
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
      .eq('schedule_id', id)
      .eq('organization_id', organization_id)
      .order('day', { referencedTable: 'schedule_lotteries', ascending: true })
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll(organization_id: string) {
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
      .eq('organization_id', organization_id)
      .order('time', { ascending: true })
      .order('day', { referencedTable: 'schedule_lotteries', ascending: true });

    if (error) throw new Error(error.details);
    return data;
  }

  async create(payload: any) {
    const { data, error } = await supabase.from('schedules').insert(payload).select().single();

    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, organization_id: string, payload: any) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('schedules')
      .update({ ...payload, edited_at: timestamp })
      .eq('schedule_id', id)
      .eq('organization_id', organization_id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async delete(id: string, organization_id: string) {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('schedule_id', id)
      .eq('organization_id', organization_id);

    if (error) throw new Error(error.details);
    return;
  }
}
