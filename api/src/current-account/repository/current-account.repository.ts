import { IUpdateCurrentAccountEntity } from '@helper/request/current_account.request';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { ICurrentAccountEntityBack } from '@helper/types/current_account.type';
import { globalCacheManager } from '../../cache/CacheManager';
import { OrgExpenseRepository } from '../../org-expense/repository/org-expense.repository';

const ORG_NETWORK_IDS_TTL = 10 * 60 * 1000; // 10 minutes

dayjs.extend(utc);
dayjs.extend(timezone);

interface INetworkSummary {
  organization_id: string;
  organization_name: string;
  total_pass: number;
  total_successes: number;
  total_claims: number;
  total_collections: number;
  total_paid: number;
  total_balance: number;
  total_leave: number;
  total_drag: number;
  cashier_count: number;
}

export class CurrentAccountRepository {
  async calculateCurrentAccountHandler(
    organization_id: string,
    date?: string,
    leave?: boolean,
    liquidated?: boolean,
    leaveInSubtotal?: boolean
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
      p_leave_in_subtotal: leaveInSubtotal ?? false,
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

    const flatten = (rows: typeof data) =>
      (rows ?? []).map((row) => ({
        ...row,
        group_id: (row as any).users?.group_id ?? null,
      }));

    if (date || user_id) {
      return flatten(data);
    }
    const byUser: Record<string, ReturnType<typeof flatten>[number]> = {};
    for (const row of flatten(data)) {
      if (!byUser[row.user_id]) {
        byUser[row.user_id] = row;
      }
    }
    return Object.values(byUser);
  }

  async cascadeCurrentAccountFromDateHandler(
    organization_id: string,
    date?: string,
    user_id?: string
  ): Promise<void> {
    let dateToProcess: string;
    if (!date) {
      dateToProcess = dayjs().tz('America/Argentina/Buenos_Aires').format('DD-MM-YYYY');
    } else {
      dateToProcess = dayjs(date).format('DD-MM-YYYY');
    }

    const { error } = await supabase.rpc('cascade_current_account_from_date', {
      p_from_date_text: dateToProcess,
      p_organization_id: organization_id,
      p_user_id: user_id ?? null,
    });
    if (error) throw error;
  }

  async updateCurrentAccountHandler(
    current_account_id: string,
    organization_id: string,
    props: IUpdateCurrentAccountEntity,
    leave?: boolean,
    leaveInSubtotal?: boolean
  ) {
    const { data, error } = await supabase.rpc('update_current_account_recompute', {
      p_current_account_id: current_account_id,
      p_props: props,
      p_calculate_leave: leave,
      p_organization_id: organization_id,
      p_leave_in_subtotal: leaveInSubtotal ?? false,
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

  // Network-aware methods for CAPITALIST users

  /**
   * Get all organization IDs in the network (parent + all descendants)
   */
  async getOrganizationNetworkIds(organization_id: string): Promise<string[]> {
    const cacheKey = `org:${organization_id}:network-ids`;
    const cached = globalCacheManager.get<string[]>(cacheKey);
    if (cached) return cached.payload;

    const { data, error } = await supabase.rpc('get_organization_descendants', {
      p_org_id: organization_id,
    });
    if (error) throw error;

    const descendantIds = (data || []).map(
      (row: { organization_id: string }) => row.organization_id
    );
    const result = [organization_id, ...descendantIds];
    globalCacheManager.set(cacheKey, result, { ttl: ORG_NETWORK_IDS_TTL });
    return result;
  }

  /**
   * Calculate current accounts for entire network (organization + all sub-organizations)
   */
  async calculateCurrentAccountNetworkHandler(
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

    const { data, error } = await supabase.rpc('calculate_current_account_network', {
      p_date_text: dateToProcess,
      p_calculate_leave: leave,
      p_liquidated: liquidated,
      p_organization_id: organization_id,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Get current accounts for entire network with support for filtering
   */
  async getAllCurrentAccountNetworkHandler({
    organization_id,
    user_id,
    date,
  }: {
    organization_id: string;
    user_id?: string;
    date?: string;
  }) {
    // Get all org IDs in the network
    const orgIds = await this.getOrganizationNetworkIds(organization_id);

    let query = supabase
      .from('current_accounts')
      .select('*, users!inner(*)')
      .in('organization_id', orgIds)
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
    if (error) throw error;

    const flatten = (rows: typeof data) =>
      (rows ?? []).map((row) => ({
        ...row,
        group_id: (row as any).users?.group_id ?? null,
      }));

    if (date || user_id) {
      return flatten(data);
    }

    // Group by user (latest entry per user)
    const byUser: Record<string, ReturnType<typeof flatten>[number]> = {};
    for (const row of flatten(data)) {
      if (!byUser[row.user_id]) {
        byUser[row.user_id] = row;
      }
    }
    return Object.values(byUser);
  }

  /**
   * Get network summary (aggregated totals per organization)
   */
  async getNetworkSummaryHandler(
    organization_id: string,
    date?: string
  ): Promise<INetworkSummary[]> {
    const { data, error } = await supabase.rpc('get_current_accounts_network_summary', {
      p_organization_id: organization_id,
      p_date: date ? dayjs(date).format('YYYY-MM-DD') : null,
    });
    if (error) throw error;
    return data || [];
  }

  /**
   * Get aggregated totals grouped by date within a date range (for print totals ticket).
   * Includes org_expenses per day so net_balance is consistent with daily tickets.
   */
  async getTotalsByDateRangeHandler(
    organization_id: string,
    date_from: string,
    date_to: string,
    user_ids?: string[]
  ): Promise<
    {
      date: string;
      total_collections: number;
      total_paid: number;
      total_bills: number;
      total_balance: number;
      total_expenses: number;
      net_balance: number;
    }[]
  > {
    const orgIds = await this.getOrganizationNetworkIds(organization_id);

    let query = supabase
      .from('current_accounts')
      .select('date, collections, paid, bills, total')
      .in('organization_id', orgIds)
      .gte('date', dayjs(date_from).format('YYYY-MM-DD'))
      .lte('date', dayjs(date_to).format('YYYY-MM-DD'))
      .order('date', { ascending: true });

    if (user_ids && user_ids.length > 0) {
      query = query.in('user_id', user_ids);
    }

    const [{ data, error }, expenseSums] = await Promise.all([
      query,
      new OrgExpenseRepository().getSumsByDateRange(organization_id, date_from, date_to),
    ]);
    if (error) throw error;

    const expenseByDate: Record<string, number> = {};
    for (const e of expenseSums) {
      expenseByDate[e.date] = e.total_expenses;
    }

    const byDate: Record<
      string,
      { total_collections: number; total_paid: number; total_bills: number; total_balance: number }
    > = {};
    for (const row of data ?? []) {
      if (!byDate[row.date]) {
        byDate[row.date] = {
          total_collections: 0,
          total_paid: 0,
          total_bills: 0,
          total_balance: 0,
        };
      }
      byDate[row.date].total_collections += Number(row.collections) || 0;
      byDate[row.date].total_paid += Number(row.paid) || 0;
      byDate[row.date].total_bills += Number(row.bills) || 0;
      byDate[row.date].total_balance += Number(row.total) || 0;
    }

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totals]) => {
        const total_expenses = expenseByDate[date] ?? 0;
        return {
          date,
          ...totals,
          total_expenses,
          net_balance: totals.total_collections - totals.total_paid - total_expenses,
        };
      });
  }

  async getDailySummaryByDateRange(
    organization_id: string,
    date_from: string,
    date_to: string,
    user_ids?: string[]
  ): Promise<
    {
      date: string;
      total_pass: number;
      total_successes: number;
      total_claims: number;
      total_subtotal: number;
      total_previous_balance: number;
      total_collections: number;
      total_paid: number;
      total_total: number;
      total_drag: number;
      total_leave: number;
    }[]
  > {
    const orgIds = await this.getOrganizationNetworkIds(organization_id);

    let query = supabase
      .from('current_accounts')
      .select(
        'date, pass, successes, claims, subtotal, previous_balance, collections, paid, total, drag, leave'
      )
      .in('organization_id', orgIds)
      .gte('date', dayjs(date_from).format('YYYY-MM-DD'))
      .lte('date', dayjs(date_to).format('YYYY-MM-DD'))
      .order('date', { ascending: true });

    if (user_ids && user_ids.length > 0) {
      query = query.in('user_id', user_ids);
    }

    const { data, error } = await query;
    if (error) throw error;

    const byDate: Record<
      string,
      {
        total_pass: number;
        total_successes: number;
        total_claims: number;
        total_subtotal: number;
        total_previous_balance: number;
        total_collections: number;
        total_paid: number;
        total_total: number;
        total_drag: number;
        total_leave: number;
      }
    > = {};

    for (const row of data ?? []) {
      if (!byDate[row.date]) {
        byDate[row.date] = {
          total_pass: 0,
          total_successes: 0,
          total_claims: 0,
          total_subtotal: 0,
          total_previous_balance: 0,
          total_collections: 0,
          total_paid: 0,
          total_total: 0,
          total_drag: 0,
          total_leave: 0,
        };
      }
      byDate[row.date].total_pass += Number(row.pass) || 0;
      byDate[row.date].total_successes += Number(row.successes) || 0;
      byDate[row.date].total_claims += Number(row.claims) || 0;
      byDate[row.date].total_subtotal += Number(row.subtotal) || 0;
      byDate[row.date].total_previous_balance += Number(row.previous_balance) || 0;
      byDate[row.date].total_collections += Number(row.collections) || 0;
      byDate[row.date].total_paid += Number(row.paid) || 0;
      byDate[row.date].total_total += Number(row.total) || 0;
      byDate[row.date].total_drag += Number(row.drag) || 0;
      byDate[row.date].total_leave += Number(row.leave) || 0;
    }

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totals]) => ({ date, ...totals }));
  }
}
