import { ILotteryEntityBack } from '@helper/types/lottery.type';
import { supabase } from '../../../database/db.connection';

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

  async getAll() {
    const { data, error } = await supabase.from('lotteries').select('*');

    if (error) throw new Error(error.details);
    return data;
  }

  async create(payload: ILotteryEntityBack) {
    const { data, error } = await supabase.from('lotteries').insert(payload).select().single();

    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, payload: any) {
    const { data, error } = await supabase
      .from('lotteries')
      .update(payload)
      .eq('lottery_id', id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async delete(id: string) {
    const { error } = await supabase.from('lottery').delete().eq('lottery_id', id);

    if (error) throw new Error(error.details);
  }
}
