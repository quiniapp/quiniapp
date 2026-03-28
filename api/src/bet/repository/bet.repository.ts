import { supabase } from '@database/db.connection';
import { TicketSums } from '@helper/request/bet.request';
import { BET_TYPE, IBetEntityBack } from '@helper/types/bet.type';
import { getTableName, getRpcName } from '../../archive/helper/archive-helper';

export class BetRepository {
  async getAllBets({
    organization_ids,
    group_user_ids,
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
    organization_ids: string[];
    group_user_ids?: string[];
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

    // Determine which table to query based on date
    const tableName = getTableName(date, 'bets');

    let query = supabase
      .from(tableName)
      .select('*, lotteries(*), schedules(*)', { count: 'exact' })
      .in('organization_id', organization_ids)
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
        .in('organization_id', organization_ids)
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
    if (group_user_ids?.length) query = query.in('user_id', group_user_ids);

    const { data, error, count } = await query;

    if (error) throw error;
    return { data, count: count ?? 0 };
  }

  async getAllBetsGrouped({
    organization_ids,
    group_user_ids,
    schedule_id,
    date,
    cashier_id,
    lottery_id,
    winners,
    quatern,
    tern,
    page = 1,
    limit = 100,
  }: {
    organization_ids: string[];
    group_user_ids?: string[];
    schedule_id?: string;
    date: string;
    cashier_id?: string;
    lottery_id?: string;
    winners?: boolean;
    quatern?: boolean;
    tern?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: IBetEntityBack[]; count: number }> {
    // Determine which RPC to use based on date
    const rpcName = getRpcName(date, 'get_grouped_bets_for_parse');

    // Helper: apply quatern/tern filter and pagination
    const applyFiltersAndPaginate = (raw: IBetEntityBack[]) => {
      let result = [...raw];
      if (quatern && tern) {
        result = result.filter(
          (bet) => bet.bet_type === BET_TYPE.QUATERN || bet.bet_type === BET_TYPE.TERN
        );
      } else if (quatern) {
        result = result.filter((bet) => bet.bet_type === BET_TYPE.QUATERN);
      } else if (tern) {
        result = result.filter((bet) => bet.bet_type === BET_TYPE.TERN);
      }
      const totalCount = result.length;
      const from = (page - 1) * limit;
      const paginatedData = result.slice(from, from + limit);
      return { data: paginatedData, count: totalCount };
    };

    // Fast path: group_user_ids provided — single RPC call with p_user_ids
    if (group_user_ids?.length) {
      const { data: rpcData, error } = await supabase.rpc(rpcName, {
        p_date: date,
        p_schedule_id: schedule_id ?? null,
        p_cashier_id: cashier_id ?? null,
        p_lottery_id: lottery_id ?? null,
        p_winners_only: !!winners,
        p_organization_id: null,
        p_user_ids: group_user_ids,
      });
      if (error) throw new Error(error.message);
      const allBets: IBetEntityBack[] = rpcData ?? [];
      return applyFiltersAndPaginate(
        allBets.sort((a, b) => ((b.amount as number) || 0) - ((a.amount as number) || 0))
      );
    }

    // Standard path: Call RPC for each org and merge results
    const orgResults = await Promise.all(
      organization_ids.map(async (orgId) => {
        const { data, error } = await supabase.rpc(rpcName, {
          p_date: date,
          p_schedule_id: schedule_id ?? null,
          p_cashier_id: cashier_id ?? null,
          p_lottery_id: lottery_id ?? null,
          p_winners_only: !!winners,
          p_organization_id: orgId,
        });
        if (error) throw error;
        return (data as IBetEntityBack[]) || [];
      })
    );

    // Merge results by grouping key, summing amount/prize/hits
    const mergedMap = new Map<string, IBetEntityBack>();
    for (const orgBets of orgResults) {
      for (const bet of orgBets) {
        const key = [
          bet.number,
          bet.lottery_id,
          bet.schedule_id,
          bet.bet_type,
          bet.place,
          bet.with,
          bet.position,
        ].join('|');
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key)!;
          existing.amount = ((existing.amount as number) || 0) + ((bet.amount as number) || 0);
          existing.prize = ((existing.prize as number) || 0) + ((bet.prize as number) || 0);
          existing.hits = ((existing.hits as number) || 0) + ((bet.hits as number) || 0);
        } else {
          mergedMap.set(key, { ...bet });
        }
      }
    }

    const sorted = Array.from(mergedMap.values()).sort(
      (a, b) => ((b.amount as number) || 0) - ((a.amount as number) || 0)
    );

    return applyFiltersAndPaginate(sorted);
  }

  async getTotalAmount({
    organization_ids,
    group_user_ids,
    date,
    schedule_id,
    cashier_id,
    lottery_id,
  }: {
    organization_ids: string[];
    group_user_ids?: string[];
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
  }) {
    // Use direct query with .in() to support multiple org IDs
    const tableName = getTableName(date, 'bets');

    let query = (supabase.from(tableName) as any)
      .select('amount.sum()')
      .in('organization_id', organization_ids)
      .eq('date', date)
      .is('deleted_at', null);

    if (schedule_id) query = query.eq('schedule_id', schedule_id);
    if (cashier_id) query = query.eq('user_id', cashier_id);
    if (lottery_id) query = query.eq('lottery_id', lottery_id);
    if (group_user_ids?.length) query = query.in('user_id', group_user_ids);

    const { data, error } = await query;
    if (error) throw error;
    return Number((data as unknown as [{ sum: string | null }])?.[0]?.sum ?? 0);
  }

  async getTotalPrize({
    organization_ids,
    group_user_ids,
    date,
    schedule_id,
    cashier_id,
    lottery_id,
  }: {
    organization_ids: string[];
    group_user_ids?: string[];
    date: string;
    schedule_id?: string;
    cashier_id?: string;
    lottery_id?: string;
  }) {
    // Use direct query with .in() to support multiple org IDs
    const tableName = getTableName(date, 'bets');

    let query = (supabase.from(tableName) as any)
      .select('prize.sum()')
      .in('organization_id', organization_ids)
      .eq('date', date)
      .eq('winner', true)
      .is('deleted_at', null);

    if (schedule_id) query = query.eq('schedule_id', schedule_id);
    if (cashier_id) query = query.eq('user_id', cashier_id);
    if (lottery_id) query = query.eq('lottery_id', lottery_id);
    if (group_user_ids?.length) query = query.in('user_id', group_user_ids);

    const { data, error } = await query;
    if (error) throw error;
    return Number((data as unknown as [{ sum: string | null }])?.[0]?.sum ?? 0);
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
    // Determine which table to query based on date
    const tableName = getTableName(date, 'bets');

    let query = supabase
      .from(tableName)
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
    organization_ids,
  }: {
    ticket_number: string;
    organization_ids: string[];
  }) {
    const zeroSums: TicketSums = {
      total_amount: 0,
      total_prize: 0,
      total_count: 0,
      total_winners_count: 0,
    };

    // Paso 1: Encontrar a qué org pertenece el ticket (búsqueda en main table)
    const { data: ticketRow } = await supabase
      .from('tickets')
      .select('organization_id')
      .eq('ticket_number', ticket_number)
      .in('organization_id', organization_ids)
      .maybeSingle();

    if (ticketRow?.organization_id != null) {
      // Ticket encontrado en main — una sola RPC call
      const { data, error } = await supabase
        .rpc('get_ticket_sums', {
          p_ticket: ticket_number,
          p_organization_id: ticketRow.organization_id,
        })
        .single();
      if (error || !data) return { ...zeroSums };
      return data as TicketSums;
    }

    // Paso 2: Buscar en archive si no está en main
    const { data: archiveTicketRow } = await supabase
      .from('tickets_archive')
      .select('organization_id')
      .eq('ticket_number', ticket_number)
      .in('organization_id', organization_ids)
      .maybeSingle();

    if (archiveTicketRow?.organization_id != null) {
      const { data, error } = await supabase
        .rpc('get_ticket_sums_archive', {
          p_ticket: ticket_number,
          p_organization_id: archiveTicketRow.organization_id,
        })
        .single();
      if (error || !data) return { ...zeroSums };
      return data as TicketSums;
    }

    return { ...zeroSums };
  }
}
