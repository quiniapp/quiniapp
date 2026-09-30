import { supabase } from '@database/db.connection';
import { NotFoundError } from '@helper/errors';
import { IPollaUserEntityBack, POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { POLLA_CREDIT_MOVEMENT_TYPE } from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';
import { PollaPagination, buildPaginated } from '../../helper/pagination';

/** Nunca se devuelven hacia afuera las columnas sensibles de auth. */
const PUBLIC_COLUMNS =
  'polla_user_id, number, user_type, name, last_name, phone, email, username, password_reset_required, locked_until, last_login_at, polla_organization_id, polla_group_id, parent_polla_user_id, fee, fee_plus, credit_balance, disabled, created_at, edited_at';

export interface PollaUserFilters {
  organizationId: string | null;
  userTypes: POLLA_USER_TYPE[];
  parentId?: string | null;
  groupId?: string | null;
  search?: string;
  includeDisabled?: boolean;
}

export class PollaUserRepository {
  async getAll(filters: PollaUserFilters, pagination: PollaPagination) {
    let query = supabase
      .from('polla_users')
      .select(PUBLIC_COLUMNS, pagination.withCount ? { count: 'exact' } : {})
      .is('deleted_at', null)
      .in('user_type', filters.userTypes);

    if (filters.organizationId) {
      query = query.eq('polla_organization_id', filters.organizationId);
    }
    if (filters.parentId) {
      query = query.eq('parent_polla_user_id', filters.parentId);
    }
    if (filters.groupId) {
      query = query.eq('polla_group_id', filters.groupId);
    }
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,username.ilike.%${filters.search}%`);
    }
    if (!filters.includeDisabled) {
      query = query.eq('disabled', false);
    }

    const { data, error, count } = await query
      .order('user_type', { ascending: true })
      .order('name', { ascending: true })
      .range(pagination.from, pagination.to);

    throwIfPollaError(error);
    return buildPaginated(data ?? [], pagination, pagination.withCount ? (count ?? 0) : null);
  }

  async getById(pollaUserId: string) {
    const { data, error } = await supabase
      .from('polla_users')
      .select(PUBLIC_COLUMNS)
      .eq('polla_user_id', pollaUserId)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Usuario de Polla');
    return data as unknown as IPollaUserEntityBack;
  }

  async create(payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('polla_users')
      .insert(payload)
      .select(PUBLIC_COLUMNS)
      .single();

    throwIfPollaError(error);
    return data;
  }

  async update(pollaUserId: string, payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('polla_users')
      .update({ ...payload, edited_at: new Date().toISOString() })
      .eq('polla_user_id', pollaUserId)
      .is('deleted_at', null)
      .select(PUBLIC_COLUMNS)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Usuario de Polla');
    return data;
  }

  async softDelete(pollaUserId: string) {
    const { data, error } = await supabase
      .from('polla_users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('polla_user_id', pollaUserId)
      .is('deleted_at', null)
      .select('polla_user_id')
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Usuario de Polla');
    return data;
  }

  // ------------------------------------------------------------- créditos

  async adjustCredits(params: {
    playerId: string;
    amount: number;
    type: POLLA_CREDIT_MOVEMENT_TYPE;
    reason: string | null;
    actorId: string;
  }) {
    const { data, error } = await supabase.rpc('polla_adjust_credits', {
      p_player_id: params.playerId,
      p_amount: params.amount,
      p_type: params.type,
      p_reason: params.reason,
      p_actor_id: params.actorId,
    });

    throwIfPollaError(error);
    return data as { success: boolean; balance: number; polla_credit_movement_id: string };
  }

  async getCreditMovements(playerId: string, pagination: PollaPagination) {
    const { data, error, count } = await supabase
      .from('polla_credit_movements')
      .select('*', pagination.withCount ? { count: 'exact' } : {})
      .eq('polla_user_id', playerId)
      .order('created_at', { ascending: false })
      .range(pagination.from, pagination.to);

    throwIfPollaError(error);
    return buildPaginated(data ?? [], pagination, pagination.withCount ? (count ?? 0) : null);
  }
}
