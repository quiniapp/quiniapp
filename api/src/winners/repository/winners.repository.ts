import { supabase } from '../../../database/db.connection';

export class WinnerRepository {
  async generateWinners() {
    const { error } = await supabase.rpc('process_bets');

    if (error) throw error;
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
