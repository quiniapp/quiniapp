import { supabase } from '@database/db.connection';
import { NotFoundError } from '@helper/errors';
import {
  IPollaCurrentAccountDailyTotals,
  IPollaCurrentAccountEntityBack,
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

/** `calculate_current_account` espera la fecha en DD-MM-YYYY. */
const toSqlDateText = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
};

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

  async calculate(params: {
    organizationId: string;
    date: string;
    calculateLeave: boolean;
    liquidated: boolean;
    leaveInSubtotal: boolean;
  }) {
    const { data, error } = await supabase.rpc('polla_calculate_current_account', {
      p_date_text: toSqlDateText(params.date),
      p_calculate_leave: params.calculateLeave,
      p_liquidated: params.liquidated,
      p_organization_id: params.organizationId,
      p_leave_in_subtotal: params.leaveInSubtotal,
    });

    throwIfPollaError(error);
    return (data ?? []) as IPollaCurrentAccountEntityBack[];
  }

  async recompute(params: {
    currentAccountId: string;
    props: Record<string, unknown>;
    organizationId: string;
    calculateLeave: boolean;
    leaveInSubtotal: boolean;
  }) {
    const { data, error } = await supabase.rpc('polla_update_current_account_recompute', {
      p_polla_current_account_id: params.currentAccountId,
      p_props: params.props,
      p_calculate_leave: params.calculateLeave,
      p_organization_id: params.organizationId,
      p_leave_in_subtotal: params.leaveInSubtotal,
    });

    throwIfPollaError(error);
    return data as IPollaCurrentAccountEntityBack;
  }

  /** Marca la fila como liquidada (Liquidar de un pasador). */
  async markLiquidated(currentAccountId: string): Promise<IPollaCurrentAccountEntityBack> {
    const { data, error } = await supabase
      .from('polla_current_accounts')
      .update({ is_liquidated: true, edited_at: new Date().toISOString() })
      .eq('polla_current_account_id', currentAccountId)
      .select('*')
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Cuenta corriente');
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

  /** Propaga el arrastre hacia adelante después de una corrección retroactiva. */
  async cascade(organizationId: string, fromDate: string, userId?: string) {
    const { error } = await supabase.rpc('polla_cascade_current_account_from_date', {
      p_from_date_text: toSqlDateText(fromDate),
      p_organization_id: organizationId,
      p_user_id: userId ?? null,
    });

    throwIfPollaError(error);
  }
}
