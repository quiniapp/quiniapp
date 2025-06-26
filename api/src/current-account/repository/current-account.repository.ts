import { IUpdateCurrentAccountEntity } from 'helper/request/current_account.response';
import { supabase } from '../../../database/db.connection';
import dayjs from 'dayjs';

export class CurrentAccountRepository {
  async calculateCurrentAccountHandler(date: string) {
    const { data, error } = await supabase.rpc('calculate_current_account', { date });
    if (error) throw error;
    return data;
  }

  async getAllCurrentAccountHandler({ user_id, date }: { user_id?: string; date?: string }) {
    let query = supabase
      .from('current_accounts')
      .select('* , user(*)')
      .eq('date', date)
      .order('created_at', { ascending: false });

    if (user_id !== undefined) {
      query = query.eq('user_id', user_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async updateCurrentAccountHandler(
    current_account_id: string,
    props: IUpdateCurrentAccountEntity
  ) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('current_accounts')
      .update({ ...props, edited_at: timestamp })
      .eq('current_account_id', current_account_id)
      .select('* , user(*)')
      .single();

    if (error) throw error;
    return data;
  }
}
