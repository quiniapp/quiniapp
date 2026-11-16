import { supabase } from '@database/db.connection';
import { NotFoundError } from '@helper/errors';
import {
  IPollaCurrentAccountDailyTotals,
  IPollaCurrentAccountEntityBack,
  IPollaCurrentAccountPeriod,
  IPollaCurrentAccountPeriodRow,
} from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';
import { PollaPagination, buildPaginated } from '../../helper/pagination';

export interface PollaCurrentAccountFilters {
  organizationId: string | null;
  date?: string;
  from?: string;
  to?: string;
  userId?: string | null;
  userNumber?: number | null;
  groupId?: string | null;
}

export class PollaCurrentAccountRepository {
  async getAll(filters: PollaCurrentAccountFilters, pagination: PollaPagination) {
    let query = supabase
      .from('polla_current_accounts')
      .select('*', pagination.withCount ? { count: 'exact' } : {});

    if (filters.organizationId) query = query.eq('polla_organization_id', filters.organizationId);
    if (filters.date) query = query.eq('date', filters.date);
    if (filters.from) query = query.gte('date', filters.from);
    if (filters.to) query = query.lte('date', filters.to);
    if (filters.userId) query = query.eq('polla_user_id', filters.userId);
    if (filters.userNumber) query = query.eq('user_number', filters.userNumber);
    if (filters.groupId) query = query.eq('polla_group_id', filters.groupId);

    const { data, error, count } = await query
      .order('date', { ascending: false })
      .order('user_number', { ascending: true })
      .range(pagination.from, pagination.to);

    throwIfPollaError(error);
    return buildPaginated(data ?? [], pagination, pagination.withCount ? (count ?? 0) : null);
  }

  /**
   * Filas de un día con los montos acumulados de su período: desde el día
   * siguiente a la última liquidación de cada pasador o, con `from`, desde ese
   * día (liquidación por rango).
   */
  async getPeriodRows(filters: {
    organizationId: string;
    date: string;
    from?: string | null;
    userId?: string | null;
    userNumber?: number | null;
    groupId?: string | null;
  }): Promise<IPollaCurrentAccountPeriodRow[]> {
    const { data, error } = await supabase.rpc('polla_current_account_period_rows', {
      p_organization_id: filters.organizationId,
      p_date: filters.date,
      p_group_id: filters.groupId ?? null,
      p_user_id: filters.userId ?? null,
      p_user_number: filters.userNumber ?? null,
      p_from: filters.from ?? null,
    });

    throwIfPollaError(error);

    return ((data ?? []) as IPollaCurrentAccountPeriodRow[]).map((row) => ({
      ...row,
      period: Object.fromEntries(
        Object.entries(row.period).map(([key, value]) => [
          key,
          key === 'from' ? value : Number(value),
        ])
      ) as unknown as IPollaCurrentAccountPeriod,
    }));
  }

  async getById(currentAccountId: string): Promise<IPollaCurrentAccountEntityBack> {
    const { data, error } = await supabase
      .from('polla_current_accounts')
      .select('*')
      .eq('polla_current_account_id', currentAccountId)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Cuenta corriente');
    return data as IPollaCurrentAccountEntityBack;
  }

  /**
   * Cambia los cobros y pagos de un día (liquidado o no) y suma la diferencia
   * al saldo de ese día y de los siguientes del pasador. Nada más cambia.
   */
  async editPayments(p: {
    organizationId: string;
    currentAccountId: string;
    collections: number;
    paid: number;
  }): Promise<IPollaCurrentAccountEntityBack> {
    const { data, error } = await supabase.rpc('polla_edit_current_account_payments', {
      p_organization_id: p.organizationId,
      p_current_account_id: p.currentAccountId,
      p_collections: p.collections,
      p_paid: p.paid,
    });

    throwIfPollaError(error);
    return data as IPollaCurrentAccountEntityBack;
  }

  /** Totales por día (pie de la tabla, cobros y pagos, resumen y subtotales). */
  async getDailyTotals(params: {
    organizationId: string;
    from: string;
    to: string;
    groupId: string | null;
    userId: string | null;
  }): Promise<IPollaCurrentAccountDailyTotals[]> {
    const { data, error } = await supabase.rpc('polla_current_account_daily_totals', {
      p_organization_id: params.organizationId,
      p_from: params.from,
      p_to: params.to,
      p_group_id: params.groupId,
      p_user_id: params.userId,
    });

    throwIfPollaError(error);

    // PostgREST devuelve los NUMERIC como texto o número según el tamaño.
    return ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const numeric = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, key === 'date' ? value : Number(value)])
      );
      return numeric as unknown as IPollaCurrentAccountDailyTotals;
    });
  }
}
