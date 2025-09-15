import { IUpdateCurrentAccountEntity } from '@helper/request/current_account.response';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export class CurrentAccountRepository {
  async calculateCurrentAccountHandler(date?: string, leave?: boolean, liquidated?: boolean) {
    // Si la fecha no se ha proporcionado (es undefined o null)

    let dateToProcess: string;
    if (!date) {
      // Usa la fecha del día anterior en la zona horaria del servidor
      dateToProcess = dayjs().tz('America/Argentina/Buenos_Aires').format('DD-MM-YYYY');
    } else {
      // Usa la fecha proporcionada, ajustando la zona horaria si es necesario
      dateToProcess = dayjs(date).format('DD-MM-YYYY');
    }

    const { data, error } = await supabase.rpc('calculate_current_account', {
      p_date_text: dateToProcess,
      p_calculate_leave: leave,
      p_liquidated: liquidated,
    });
    if (error) throw error;
    return data;
  }

  async getAllCurrentAccountHandler({
    user_id,
    date,
    liquidated,
  }: {
    user_id?: string;
    date?: string;
    liquidated?: boolean;
  }) {
    // base con join a users y filtro de borrados
    const base = supabase
      .from('current_accounts')
      .select('*, users!inner(*)')
      .is('users.deleted_at', null);

    // === CASO 1: viene user_id ===
    if (user_id) {
      let q = base.eq('user_id', user_id);

      if (date) {
        // 1.a) user_id + date -> ese día
        q = q
          .eq('date', dayjs(date).format('YYYY-MM-DD'))
          .order('date', { ascending: false })
          .order('user_number', { ascending: true });
        const { data, error } = await q;
        if (error) throw error;
        return data; // array (0..n), normalmente 1
      } else {
        // 1.b) user_id sin date -> última liquidada
        q = q.eq('is_liquidated', true).order('date', { ascending: false }).limit(1);
        const { data, error } = await q;
        if (error) throw error;

        // Fallback opcional: si no hay liquidada, traer la última cualquiera
        // if (!data || data.length === 0) {
        //   const { data: fallback, error: err2 } = await base
        //     .eq('user_id', user_id)
        //     .order('date', { ascending: false })
        //     .limit(1);
        //   if (err2) throw err2;
        //   return fallback ?? [];
        // }

        return data ?? [];
      }
    }

    // === CASO 2: no viene user_id y sí viene date ===
    if (date) {
      let q = base.eq('date', dayjs(date).format('YYYY-MM-DD'));
      if (typeof liquidated === 'boolean') q = q.eq('is_liquidated', liquidated);
      q = q.order('user_number', { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    }

    // === CASO 3: no user_id y no date -> última por usuario (dedup)
    {
      let q = base.order('date', { ascending: false }).order('user_number', { ascending: true });
      if (typeof liquidated === 'boolean') q = q.eq('is_liquidated', liquidated);

      const { data, error } = await q;
      if (error) throw error;

      const byUser: Record<string, (typeof data)[number]> = {};
      for (const row of data ?? []) {
        if (!byUser[row.user_id]) byUser[row.user_id] = row; // ya viene ordenado: primera es la más reciente
      }
      return Object.values(byUser);
    }
  }

  async updateCurrentAccountHandler(
    current_account_id: string,
    props: IUpdateCurrentAccountEntity,
    leave?: boolean
  ) {
    const { data, error } = await supabase.rpc('update_current_account_recompute', {
      p_current_account_id: current_account_id,
      p_props: props,
      p_calculate_leave: leave,
    });
    if (error) throw error;
    return data;
  }
  async updateCurrentAccountByUserHandler(
    current_account_id: string,
    props: IUpdateCurrentAccountEntity
  ) {
    const timestamp = dayjs().toISOString();

    const { data, error } = await supabase
      .from('current_accounts')
      .update({ ...props, edited_at: timestamp })
      .eq('current_account_id', current_account_id)
      .single(); // esperamos una sola fila

    if (error) throw error;
    // data es la fila actualizada
    return data;
  }
}
