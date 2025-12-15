import { IUpdateCurrentAccountEntity } from '@helper/request/current_account.response';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { ICurrentAccountEntityBack } from '@helper/types/current_account.type';

dayjs.extend(utc);
dayjs.extend(timezone);

export class CurrentAccountRepository {
  async calculateCurrentAccountHandler(
    organization_id: string,
    date?: string,
    leave?: boolean,
    liquidated?: boolean
  ) {
    let dateToProcess: string;
    if (!date) {
      dateToProcess = dayjs().tz('America/Argentina/Buenos_Aires').format('DD-MM-YYYY');
    } else {
      dateToProcess = dayjs(date).format('DD-MM-YYYY');
    }

    const { data, error } = await supabase.rpc('calculate_current_account', {
      p_date_text: dateToProcess,
      p_calculate_leave: leave,
      p_liquidated: liquidated,
      p_organization_id: organization_id,
    });
    if (error) throw error;
    return data;
  }

  async getAllCurrentAccountHandler({
    organization_id,
    user_id,
    date,
  }: {
    organization_id: string;
    user_id?: string;
    date?: string;
  }) {
    let query = supabase
      .from('current_accounts')
      .select('*, users!inner(*)')
      .eq('organization_id', organization_id)
      .is('users.deleted_at', null)
      .order('date', { ascending: false })
      .order('user_number', { ascending: true });

    if (user_id) {
      query = query.eq('user_id', user_id).limit(1);
    }
    if (date) {
      query = query.eq('date', dayjs(date).format('YYYY-MM-DD'));
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    if (date || user_id) {
      return data;
    }
    const byUser: Record<string, (typeof data)[number]> = {};
    for (const row of data ?? []) {
      if (!byUser[row.user_id]) {
        byUser[row.user_id] = row;
      }
    }
    return Object.values(byUser);
  }

  async updateCurrentAccountHandler(
    current_account_id: string,
    organization_id: string,
    props: IUpdateCurrentAccountEntity,
    leave?: boolean
  ) {
    const { data, error } = await supabase.rpc('update_current_account_recompute', {
      p_current_account_id: current_account_id,
      p_props: props,
      p_calculate_leave: leave,
      p_organization_id: organization_id,
    });
    if (error) throw error;
    return data;
  }

  async updateCurrentAccountByUserHandler(
    current_account_id: string,
    organization_id: string,
    props: IUpdateCurrentAccountEntity
  ) {
    const timestamp = dayjs().toISOString();

    const { data, error } = await supabase
      .from('current_accounts')
      .update({ ...props, edited_at: timestamp })
      .eq('current_account_id', current_account_id)
      .eq('organization_id', organization_id)
      .single();

    if (error) throw error;
    return data;
  }

  async getCurrentAccountByUserHandler(
    user_id: string,
    organization_id: string,
    date?: string
  ): Promise<ICurrentAccountEntityBack | undefined> {
    const query = supabase
      .from('current_accounts')
      .select('*')
      .eq('user_id', user_id)
      .eq('organization_id', organization_id);

    if (date) {
      const { data, error } = await query.eq('date', date).maybeSingle();
      if (error) throw error;
      return data ?? undefined;
    } else {
      const { data, error } = await query
        .eq('is_liquidated', true)
        .order('date', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0];
    }
  }
}
