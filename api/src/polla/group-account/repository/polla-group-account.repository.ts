import { supabase } from '@database/db.connection';
import {
  IPollaGroupAccountEntityBack,
  IPollaGroupAccountPreview,
} from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';
import { PollaPagination, buildPaginated } from '../../helper/pagination';

export interface PollaGroupAccountFilters {
  organizationId: string;
  groupId?: string | null;
  from?: string | null;
  to?: string | null;
}

export class PollaGroupAccountRepository {
  /** Liquidaciones de grupos, de la más nueva a la más vieja. */
  async getAll(filters: PollaGroupAccountFilters, pagination: PollaPagination) {
    let query = supabase
      .from('polla_group_accounts')
      .select('*', pagination.withCount ? { count: 'exact' } : {})
      .eq('polla_organization_id', filters.organizationId);

    if (filters.groupId) query = query.eq('polla_group_id', filters.groupId);
    if (filters.from) query = query.gte('date', filters.from);
    if (filters.to) query = query.lte('date', filters.to);

    const { data, error, count } = await query
      .order('date', { ascending: false })
      .order('group_name', { ascending: true })
      .range(pagination.from, pagination.to);

    throwIfPollaError(error);
    return buildPaginated(
      (data ?? []) as IPollaGroupAccountEntityBack[],
      pagination,
      pagination.withCount ? (count ?? 0) : null
    );
  }

  /** Lo que se liquidaría al grupo a esa fecha y qué pasadores faltan liquidar. */
  async preview(organizationId: string, groupId: string, date: string) {
    const { data, error } = await supabase.rpc('polla_group_account_preview', {
      p_organization_id: organizationId,
      p_group_id: groupId,
      p_date: date,
    });

    throwIfPollaError(error);
    // `liquidated_on_date` lo agrega la ruta.
    return data as Omit<IPollaGroupAccountPreview, 'liquidated_on_date'>;
  }

  async liquidate(params: {
    organizationId: string;
    groupId: string;
    date: string;
    percentage: number;
    adjustments: number;
    paid: number;
    actorId: string;
  }) {
    const { data, error } = await supabase.rpc('polla_liquidate_group', {
      p_organization_id: params.organizationId,
      p_group_id: params.groupId,
      p_date: params.date,
      p_percentage: params.percentage,
      p_adjustments: params.adjustments,
      p_paid: params.paid,
      p_actor_id: params.actorId,
    });

    throwIfPollaError(error);
    return data as IPollaGroupAccountEntityBack;
  }
}
