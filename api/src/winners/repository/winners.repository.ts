import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';

export class WinnerRepository {
  async generateWinners(schedule_id: string, date: string) {
    const { error } = await supabase.rpc('generate_winners', {
      target_id: schedule_id,
      bet_date: date,
    });

    if (error) throw error;

    const dateToProcess: string = dayjs(date)
      .tz('America/Argentina/Buenos_Aires')
      .format('DD-MM-YYYY');

    const { error: currentAccountError } = await supabase.rpc('calculate_current_account', {
      p_date_text: dateToProcess,
    });
    if (currentAccountError) throw currentAccountError;

    return true;
  }

  async getAllWinners(user_id?: string) {
    let query = supabase
      .from('tickets')
      .select('*, bets(*, lotteries(*), schedules(*))')
      .is('winner', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (user_id !== undefined) {
      query = query.eq('user_id', user_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data;
  }
}
