import { supabase } from '@database/db.connection';

export class WinnerRepository {
  async generateWinners({
    schedule_id,
    date,
    organization_id,
  }: {
    schedule_id: string;
    date: string;
    organization_id: string;
  }) {
    console.log('asdf', {
      schedule_id,
      date,
      organization_id,
    });
    const { data, error } = await supabase.rpc('generate_winners_and_calculate_accounts', {
      p_schedule_id: schedule_id,
      p_date: date,
      p_organization_id: organization_id,
    });
    console.log(data, error);
    if (error) throw error;

    return data;
  }

  async getAllWinners({ organization_id, user_id }: { organization_id: string; user_id?: string }) {
    let query = supabase
      .from('tickets')
      .select('*, bets(*, lotteries(*), schedules(*))')
      .eq('organization_id', organization_id)
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
