import { supabase } from '@database/db.connection';
import { TicketSums } from '@helper/request/bet.request';
import { BET_TYPE, IBetEntityBack } from '@helper/types/bet.type';
import { getTableName } from '../../archive/helper/archive-helper';
import {
  CURSOR_INT,
  CURSOR_TIMESTAMP,
  CURSOR_UUID,
  decodeCursor,
  keysetPage,
} from '../../utils/keyset';

/**
 * Columnas del listado: las que lee `parseBet`, más `created_at` y `bet_order`
 * para el cursor. Las tablas de terminal y la cuenta corriente leen `lottery` y
 * `schedule` sin `?.`: los embebidos se achican a lo que usan `parseLottery` y
 * `parseSchedule`, pero no se quitan.
 */
const BET_LIST_COLUMNS =
  'bet_id, bet_type, ticket_id, user_id, number, amount, place, with, position, date, winner, ' +
  'paid, lottery_id, schedule_id, prize, hits, cashier_name, ticket_number, created_at, bet_order, ' +
  'lotteries(lottery_id, name, order, active), schedules(schedule_id, name, time, active)';

/** Orden del listado: `created_at DESC, bet_order ASC, bet_id ASC` (desempate único). */
const BET_CURSOR = [CURSOR_TIMESTAMP, CURSOR_INT, CURSOR_UUID];

type BetListRow = IBetEntityBack & { bet_order: number };

export class BetRepository {
  /**
   * Listado de jugadas con paginación keyset, alineado con
   * `idx_bets_org_date_feed (organization_id, date, created_at DESC, bet_order, bet_id)`.
   * `cursor` vacío = primera página. No cuenta filas: `hasMore` sale de pedir
   * `limit + 1`.
   */
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
    cursor = '',
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
    cursor?: string;
    limit?: number;
  }): Promise<{ data: BetListRow[]; hasMore: boolean; next_cursor: string | null }> {
    const tableName = getTableName(date, 'bets');

    let query = supabase.from(tableName).select(BET_LIST_COLUMNS);

    // La organización va por igualdad: con `in` (`= ANY(array)`) el índice no
    // entrega el orden y la base ordena el día completo.
    query =
      organization_ids.length === 1
        ? query.eq('organization_id', organization_ids[0])
        : query.in('organization_id', organization_ids);

    query = query.eq('date', date).is('deleted_at', null);

    // bets.ticket_number está indexado: no hace falta buscar antes el ticket_id.
    if (ticket_number) query = query.eq('ticket_number', ticket_number);
    if (quatern) query = query.eq('bet_type', BET_TYPE.QUATERN);
    if (tern) query = query.eq('bet_type', BET_TYPE.TERN);
    if (schedule_id) query = query.eq('schedule_id', schedule_id);
    if (cashier_id) query = query.eq('user_id', cashier_id);
    if (winners) query = query.eq('winner', true);
    if (lottery_id) query = query.eq('lottery_id', lottery_id);
    if (group_user_ids?.length) query = query.in('user_id', group_user_ids);

    if (cursor) {
      const [createdAt, betOrder, betId] = decodeCursor(cursor, BET_CURSOR);
      // PostgREST no tiene row values: el `lte` redundante acota el rango del
      // índice y el OR desempata dentro del mismo created_at.
      query = query
        .lte('created_at', createdAt)
        .or(
          `created_at.lt.${createdAt},` +
            `and(created_at.eq.${createdAt},bet_order.gt.${betOrder}),` +
            `and(created_at.eq.${createdAt},bet_order.eq.${betOrder},bet_id.gt.${betId})`
        );
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('bet_order', { ascending: true })
      .order('bet_id', { ascending: true })
      .limit(limit + 1);

    if (error) throw error;

    return keysetPage((data ?? []) as unknown as BetListRow[], limit, (bet) => [
      bet.created_at,
      bet.bet_order,
      bet.bet_id,
    ]);
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
    min_amount = 0,
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
    min_amount?: number;
    page?: number;
    limit?: number;
  }): Promise<{ data: IBetEntityBack[]; count: number }> {
    const isArchived = getTableName(date, 'bets') === 'bets_archive';
    const rpcName = isArchived
      ? 'get_grouped_bets_for_parse_archive'
      : 'get_grouped_bets_for_parse';
    const countRpcName = isArchived ? 'get_grouped_bets_count_archive' : 'get_grouped_bets_count';

    // Build bet_types filter (replaces JS-side tern/quatern filtering)
    let betTypes: BET_TYPE[] | null = null;
    if (quatern && tern) betTypes = [BET_TYPE.QUATERN, BET_TYPE.TERN];
    else if (quatern) betTypes = [BET_TYPE.QUATERN];
    else if (tern) betTypes = [BET_TYPE.TERN];

    const orgId = organization_ids[0];
    const offset = (page - 1) * limit;

    const baseParams = {
      p_date: date,
      p_schedule_id: schedule_id ?? null,
      p_cashier_id: cashier_id ?? null,
      p_lottery_id: lottery_id ?? null,
      p_winners_only: !!winners,
      p_organization_id: group_user_ids?.length ? null : orgId,
      p_user_ids: group_user_ids?.length ? group_user_ids : null,
      p_min_amount: min_amount,
      p_bet_types: betTypes,
    };

    if (page === 1) {
      // Page 1: fetch data + count in parallel
      const [dataResult, countResult] = await Promise.all([
        supabase.rpc(rpcName, { ...baseParams, p_limit: limit, p_offset: offset }),
        supabase.rpc(countRpcName, baseParams),
      ]);
      if (dataResult.error) throw new Error(dataResult.error.message);
      if (countResult.error) throw new Error(countResult.error.message);
      return {
        data: (dataResult.data as IBetEntityBack[]) ?? [],
        count: Number(countResult.data ?? 0),
      };
    }

    // Pages 2+: data only (count cached by frontend from page 1)
    const { data, error } = await supabase.rpc(rpcName, {
      ...baseParams,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    return { data: (data as IBetEntityBack[]) ?? [], count: 0 };
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
    const isArchived = getTableName(date, 'bets') === 'bets_archive';
    const rpcName = isArchived ? 'get_bets_total_amount_archive' : 'get_bets_total_amount';

    const { data, error } = await supabase.rpc(rpcName, {
      p_organization_ids: organization_ids,
      p_date: date,
      p_schedule_id: schedule_id ?? null,
      p_cashier_id: cashier_id ?? null,
      p_lottery_id: lottery_id ?? null,
      p_user_ids: group_user_ids?.length ? group_user_ids : null,
    });

    if (error) throw error;
    return Number(data ?? 0);
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
    const isArchived = getTableName(date, 'bets') === 'bets_archive';
    const rpcName = isArchived ? 'get_bets_total_prize_archive' : 'get_bets_total_prize';

    const { data, error } = await supabase.rpc(rpcName, {
      p_organization_ids: organization_ids,
      p_date: date,
      p_schedule_id: schedule_id ?? null,
      p_cashier_id: cashier_id ?? null,
      p_lottery_id: lottery_id ?? null,
      p_user_ids: group_user_ids?.length ? group_user_ids : null,
    });

    if (error) throw error;
    return Number(data ?? 0);
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

    // Query both tables in parallel to avoid sequential round-trips
    const [{ data: ticketRow }, { data: archiveTicketRow }] = await Promise.all([
      supabase
        .from('tickets')
        .select('organization_id')
        .eq('ticket_number', ticket_number)
        .in('organization_id', organization_ids)
        .maybeSingle(),
      supabase
        .from('tickets_archive')
        .select('organization_id')
        .eq('ticket_number', ticket_number)
        .in('organization_id', organization_ids)
        .maybeSingle(),
    ]);

    if (ticketRow?.organization_id != null) {
      const { data, error } = await supabase
        .rpc('get_ticket_sums', {
          p_ticket: ticket_number,
          p_organization_id: ticketRow.organization_id,
        })
        .single();
      if (error || !data) return { ...zeroSums };
      return data as TicketSums;
    }

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
