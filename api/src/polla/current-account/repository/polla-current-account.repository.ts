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

  /**
   * Filas de un día con los montos acumulados de su período (desde el día
   * siguiente a la última liquidación de cada pasador).
   */
  async getPeriodRows(filters: {
    organizationId: string;
    date: string;
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

  /**
   * "Actualizar": recalcula los días del período abierto más viejo de la
   * organización hasta `date` y vuelve a encadenar los saldos.
   */
  async recalculateOpenPeriod(organizationId: string, date: string) {
    const { error } = await supabase.rpc('polla_recalculate_open_period', {
      p_organization_id: organizationId,
      p_date: date,
    });

    throwIfPollaError(error);
  }

  /** Liquida el día de todos los pasadores de la organización (cierra sus períodos). */
  async markDayLiquidated(organizationId: string, date: string) {
    const { error } = await supabase
      .from('polla_current_accounts')
      .update({ is_liquidated: true, edited_at: new Date().toISOString() })
      .eq('polla_organization_id', organizationId)
      .eq('date', date);

    throwIfPollaError(error);
  }

  /** Último día en que se liquidó la cuenta de un pasador (o `null`). */
  async getLastLiquidatedDate(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('polla_current_accounts')
      .select('date')
      .eq('polla_user_id', userId)
      .eq('is_liquidated', true)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfPollaError(error);
    return data?.date ?? null;
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
