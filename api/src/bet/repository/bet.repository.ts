import { supabase } from '@database/db.connection';

export class BetRepository {
  async getAllBets({
    schedule_id,
    date,
    cashier_id,
    lottery_id,
    winners,
  }: {
    schedule_id?: string;
    date: string;
    cashier_id?: string;
    lottery_id?: string;

    winners?: boolean;
  }) {
    let query = supabase.from('bets').select('*, lotteries(*), schedules(*)').eq('date', date);

    if (schedule_id) {
      query = query.eq('schedule_id', schedule_id);
    }
    if (cashier_id) {
      query = query.eq('user_id', cashier_id);
    }
    if (winners) {
      query = query.eq('winner', true);
    }
    if (lottery_id) query = query.eq('lottery_id', lottery_id);
    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  async getAllBetsGrouped({
    schedule_id,
    date,
    cashier_id,
    lottery_id,
    winners,
  }: {
    schedule_id?: string;
    date: string;
    cashier_id?: string;
    lottery_id?: string;

    winners?: boolean;
  }) {
    let query = supabase.from('bets').select('number, sum:amount').eq('date', date).group('number');

    if (schedule_id) query = query.eq('schedule_id', schedule_id);
    if (cashier_id) query = query.eq('user_id', cashier_id);
    if (lottery_id) query = query.eq('lottery_id', lottery_id);
    if (winners) query = query.eq('winner', true);

    const { data, error } = await query;

    if (error) throw error;

    // Normalizamos el nombre del campo sum
    return data.map((item) => ({
      number: item.number,
      amount: item.sum,
    }));
  }
}
