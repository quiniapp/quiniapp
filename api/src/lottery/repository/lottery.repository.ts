import { ILotteryEntityBack } from '@helper/types/lottery.type';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';

export class LotteryRepository {
  async getById(id: string, organization_id: string) {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .eq('lottery_id', id)
      .eq('organization_id', organization_id)
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll(organization_id: string, all?: boolean) {
    let query = supabase.from('lotteries').select('*').eq('organization_id', organization_id);

    if (!all) {
      query = query.eq('active', true);
    }
    const { data, error } = await query.order('order', { ascending: true });
    if (error) throw new Error(error.details);
    return data;
  }

  async create(payload: ILotteryEntityBack) {
    const { data, error } = await supabase.from('lotteries').insert(payload).select().single();

    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, payload: any, organization_id: string) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('lotteries')
      .update({ ...payload, edited_at: timestamp })
      .eq('lottery_id', id)
      .eq('organization_id', organization_id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async delete(id: string, organization_id: string) {
    const timestamp = dayjs().toISOString();
    const { error } = await supabase
      .from('lotteries')
      .update({ deleted_at: timestamp })
      .eq('lottery_id', id)
      .eq('organization_id', organization_id);

    if (error) throw new Error(error.details);
  }
}
