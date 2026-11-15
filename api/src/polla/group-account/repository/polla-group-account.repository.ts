import { supabase } from '@database/db.connection';
import { IPollaGroupAccountEntityBack } from '@helper/polla/types/game.type';
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
}
