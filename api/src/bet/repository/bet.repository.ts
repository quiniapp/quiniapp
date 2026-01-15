import { supabase } from '@database/db.connection';
import { TicketSums } from '@helper/request/bet.request';
import { BET_TYPE, IBetEntityBack } from '@helper/types/bet.type';

export class BetRepository {
  async getAllBets({
    organization_id,
    schedule_id,
    date,
    cashier_id,
    lottery_id,
    winners,
    quatern,
    tern,
    ticket_number,
    page = 1,
    limit = 100,
  }: {
    organization_id: string;
    schedule_id?: string;
    date: string;
    cashier_id?: string;
    lottery_id?: string;
    winners?: boolean;
    quatern?: boolean;
    tern?: boolean;
    ticket_number?: string;
    page?: number;
    limit?: number;
  }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('bets')
      .select('*, lotteries(*), schedules(*)', { count: 'exact' })
      .eq('organization_id', organization_id)
      .eq('date', date)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('bet_order', { ascending: true })
      .range(from, to);

    if (ticket_number) {
      const { data: ticket, error: errorTicketNumber } = await supabase
        .from('tickets')
        .select('ticket_id')
        .eq('ticket_number', ticket_number)
        .eq('organization_id', organization_id)
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

    const { data, error, count } = await query;

    if (error) throw error;
    return { data, count: count ?? 0 };
  }

  async getAllBetsGrouped({
    organization_id,
    schedule_id,
    date,
    cashier_id,
    lottery_id,
    winners,
    quatern,
    tern,
  }: {
    organization_id: string;
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
      p_organization_id: organization_id,
    });

    if (error) throw error;

    if (quatern && tern) {
      return data.filter(
        (bet: IBetEntityBack) => bet.bet_type === BET_TYPE.QUATERN || bet.bet_type === BET_TYPE.TERN
      );
    }
    if (quatern) {
      return data.filter((bet: IBetEntityBack) => bet.bet_type === BET_TYPE.QUATERN);
    }
    if (tern) {
      return data.filter((bet: IBetEntityBack) => bet.bet_type === BET_TYPE.TERN);
    }

    return data;
  }

  async getTotalAmount({
    organization_id,
    date,
    schedule_id,
    cashier_id,
    lottery_id,
  }: {
    organization_id: string;
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
      p_organization_id: organization_id,
    });
    if (error) throw error;
    return data as number;
  }

  async getTotalPrize({
    organization_id,
    date,
    schedule_id,
    cashier_id,
    lottery_id,
  }: {
    organization_id: string;
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
      p_organization_id: organization_id,
    });
    if (error) throw error;
    return data as number;
  }

  async getWinnerBets({
    organization_id,
    date,
    schedule_id,
    cashier_id,
    lottery_id,
    ticket_number,
  }: {
    organization_id: string;
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
    ticket_number?: string;
  }) {
    let query = supabase
      .from('bets')
      .select('*, lotteries(*), schedules(*)')
      .eq('organization_id', organization_id)
      .eq('date', date)
      .eq('winner', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (ticket_number) {
      const ticket = supabase
        .from('tickets')
        .select('ticket_id')
        .eq('ticket_number', ticket_number)
        .eq('organization_id', organization_id);
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

  async getAmountsByTicket({
    ticket_number,
    organization_id,
  }: {
    ticket_number: string;
    organization_id: string;
  }) {
    const { data, error } = await supabase
      .rpc('get_ticket_sums', {
        p_ticket: ticket_number,
        p_organization_id: organization_id,
      })
      .single();

    if (error) throw error;
    return data as TicketSums;
  }
}
