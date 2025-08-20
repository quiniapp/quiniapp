import { IUpdateCurrentAccountEntity } from '@helper/request/current_account.response';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export class CurrentAccountRepository {
  async calculateCurrentAccountHandler(date?: string) {
    // Si la fecha no se ha proporcionado (es undefined o null)
    let dateToProcess: string;
    if (!date) {
      // Usa la fecha del día anterior en la zona horaria del servidor
      dateToProcess = dayjs()
        .tz('America/Argentina/Buenos_Aires')
        .subtract(1, 'day')
        .format('DD-MM-YYYY');
      console.log('No date provided. Using previous day:', dateToProcess);
    } else {
      // Usa la fecha proporcionada, ajustando la zona horaria si es necesario
      dateToProcess = dayjs(date).tz('America/Argentina/Buenos_Aires').format('DD-MM-YYYY');
      console.log('Using provided date:', dateToProcess);
    }

    const { data, error } = await supabase.rpc('calculate_current_account', {
      p_date_text: dateToProcess,
    });
    if (error) throw error;
    return data;
  }

  async getAllCurrentAccountHandler({ user_id, date }: { user_id?: string; date?: string }) {
    console.log('get', date);
    // Base query to select current accounts and join with users table
    let query = supabase
      .from('current_accounts')
      .select('*, users!inner(*)')
      .is('users.deleted_at', null)
      .order('created_at', { ascending: false })
      .order('user_number', { ascending: true });

    // If a user_id is provided, filter the results for that specific user.
    // The .order() method already ensures the newest record is first.
    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    // If a date is provided, filter the results for that specific date.
    if (date) {
      query = query.eq('date', dayjs(date).format('YYYY-MM-DD'));
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    // If a specific date or user_id was provided, we don't need to deduplicate.
    // We can return the results directly.
    if (date || user_id) {
      return data;
    }

    // If neither a user_id nor a date was provided,
    // we need to return the *most recent* current account for *each* user.
    // The .order() method already has the most recent one at the beginning of the array.
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
    props: IUpdateCurrentAccountEntity
  ) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('current_accounts')
      .update({ ...props, edited_at: timestamp })
      .eq('current_account_id', current_account_id)
      .select('* , users(*)')
      .single();

    if (error) throw error;
    return data;
  }
}
