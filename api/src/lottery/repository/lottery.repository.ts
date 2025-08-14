import { ILotteryEntityBack } from '@helper/types/lottery.type';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';

export class LotteryRepository {
  async getById(id: string) {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .eq('lottery_id', id)
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll(all?: boolean) {
    let query = supabase.from('lotteries').select('*');

    if (!all) {
      query = query.eq('active', true);
    }
    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw new Error(error.details);
    return data;
  }

  async create(payload: ILotteryEntityBack) {
    const { data, error } = await supabase.from('lotteries').insert(payload).select().single();

    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, payload: any) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('lotteries')
      .update({ ...payload, deleted_at: timestamp })
      .eq('lottery_id', id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async delete(id: string) {
    const timestamp = dayjs().toISOString();
    const { error } = await supabase
      .from('lottery')
      .update({ deleted_at: timestamp })
      .eq('lottery_id', id);

    if (error) throw new Error(error.details);
  }
}
