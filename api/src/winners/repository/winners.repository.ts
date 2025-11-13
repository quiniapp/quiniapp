import { supabase } from '@database/db.connection';

export class WinnerRepository {
  async generateWinners(schedule_id: string, date: string) {
    // Usar función unificada que ejecuta ambas operaciones en una sola transacción
    const { data, error } = await supabase.rpc('generate_winners_and_calculate_accounts', {
      p_schedule_id: schedule_id,
      p_bet_date: date,
    });

    if (error) throw error;

    // Retornar resultado con estadísticas
    return data;
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
