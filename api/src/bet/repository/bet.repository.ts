import { supabase } from '@database/db.connection';
import { BET_TYPE, IBetEntityBack } from '@helper/types/bet.type';

export class BetRepository {
  async getAllBets({
    schedule_id,
    date,
    cashier_id,
    lottery_id,
    winners,
    quatern,
    tern,
    ticket_number,
  }: {
    schedule_id?: string;
    date: string;
    cashier_id?: string;
    lottery_id?: string;
    winners?: boolean;
    quatern?: boolean;
    tern?: boolean;
    ticket_number?: string;
  }) {
    let query = supabase
      .from('bets')
      .select('*, lotteries(*), schedules(*)')
      .eq('date', date)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }) // 1° por fecha de creación (tickets más nuevos primero)
      .order('bet_order', { ascending: true }); // 2° por bloque dentro del ticket
    // .order('created_at', { ascending: true, referencedTable : 'lotteries' }); // 3️⃣ Dentro del bloque, orden por creación de la lotería

    if (ticket_number) {
      const { data: ticket, error: errorTicketNumber } = await supabase
        .from('tickets')
        .select('ticket_id')
        .eq('ticket_number', ticket_number)
        .single();
      if (errorTicketNumber) throw errorTicketNumber;
      query = query.eq('ticket_id', ticket?.ticket_id);
    }

    if (quatern) query = query.eq('bet_type', BET_TYPE.QUATERN);
    if (tern) query = query.eq('bet_type', BET_TYPE.TERN);
    if (schedule_id) query = query.eq('schedule_id', schedule_id);
    if (cashier_id) query = query.eq('user_id', cashier_id);
    if (winners) query = query.eq('winner', true);
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
    quatern,
    tern,
  }: {
    schedule_id?: string;
    date: string;
    cashier_id?: string;
    lottery_id?: string;
    winners?: boolean;
    quatern?: boolean;
    tern?: boolean;
  }) {
    const { data, error } = await supabase.rpc('get_grouped_bets_for_parse', {
      p_date: date,
      p_schedule_id: schedule_id ?? null,
      p_cashier_id: cashier_id ?? null,
      p_lottery_id: lottery_id ?? null,
      p_winners_only: !!winners,
    });

    if (error) throw error;

    if (quatern) {
      if (tern) {
        return data.filter(
          (bet: IBetEntityBack) =>
            bet.bet_type === BET_TYPE.QUATERN || bet.bet_type === BET_TYPE.TERN
        );
      }
      return data.filter((bet: IBetEntityBack) => bet.bet_type === BET_TYPE.QUATERN);
    }
    if (tern) {
      return data.filter((bet: IBetEntityBack) => bet.bet_type === BET_TYPE.TERN);
    }

    return data;
  }

  async getTotalAmount({
    date,
    schedule_id,
    cashier_id,
    lottery_id,
  }: {
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
  }) {
    const { data, error } = await supabase.rpc('bets_total_amount', {
      p_date: date,
      p_schedule_id: schedule_id ?? null,
      p_cashier_id: cashier_id ?? null,
      p_lottery_id: lottery_id ?? null,
    });
    if (error) throw error;
    return data as number; // total en moneda
  }

  async getTotalPrize({
    date,
    schedule_id,
    cashier_id,
    lottery_id,
  }: {
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
  }) {
    const { data, error } = await supabase.rpc('bets_total_prize', {
      p_date: date,
      p_schedule_id: schedule_id ?? null,
      p_cashier_id: cashier_id ?? null,
      p_lottery_id: lottery_id ?? null,
    });
    if (error) throw error;
    return data as number; // cantidad de aciertos
  }

  async getWinnerBets({
    date,
    schedule_id,
    cashier_id,
    lottery_id,
    ticket_number,
  }: {
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
    ticket_number?: string;
  }) {
    let query = supabase
      .from('bets')
      .select('*, lotteries(*), schedules(*)')
      .eq('date', date)
      .eq('winner', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (ticket_number) {
      const ticket = supabase
        .from('tickets')
        .select('ticket_id')
        .eq('ticket_number', ticket_number);
      query = query.eq('ticket_id', ticket);
    }
    if (schedule_id) {
      query = query.eq('schedule_id', schedule_id);
    }
    if (cashier_id) {
      query = query.eq('user_id', cashier_id);
    }

    if (lottery_id) query = query.eq('lottery_id', lottery_id);
    const { data, error } = await query;

    if (error) throw error;
    return data;
  }
}
