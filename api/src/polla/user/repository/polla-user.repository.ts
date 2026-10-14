import { supabase } from '@database/db.connection';
import { ConflictError, NotFoundError } from '@helper/errors';
import {
  IPollaUserByNumber,
  IPollaUserEntityBack,
  IPollaUserOption,
  POLLA_USER_TYPE,
} from '@helper/polla/types/user.type';
import { throwIfPollaError } from '../../helper/polla-errors';
import { PollaPagination, buildPaginated } from '../../helper/pagination';
import { ilikeAny } from '../../helper/search';

/** Nunca se devuelven hacia afuera las columnas sensibles de auth. */
const PUBLIC_COLUMNS =
  'polla_user_id, number, user_type, name, last_name, phone, email, username, password_reset_required, locked_until, last_login_at, polla_organization_id, polla_group_id, parent_polla_user_id, fee, fee_plus, disabled, created_at, edited_at';

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
    const searchFilter = filters.search
      ? ilikeAny(['name', 'last_name', 'username'], filters.search)
      : null;
    if (searchFilter) {
      query = query.or(searchFilter);
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

  /** Si otro usuario activo del mismo tipo ya usa ese número en la organización. */
  async isNumberTaken(params: {
    organizationId: string;
    userType: POLLA_USER_TYPE;
    number: number;
    excludeId?: string;
  }) {
    let query = supabase
      .from('polla_users')
      .select('polla_user_id', { count: 'exact', head: true })
      .eq('polla_organization_id', params.organizationId)
      .eq('user_type', params.userType)
      .eq('number', params.number)
      .is('deleted_at', null);

    if (params.excludeId) query = query.neq('polla_user_id', params.excludeId);

    const { count, error } = await query;

    throwIfPollaError(error);
    return (count ?? 0) > 0;
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

  /**
   * Pasador o jugador por número dentro de una organización, para cargarle una
   * jugada a su nombre. `parentId` acota a los jugadores de un pasador.
   */
  async getByNumber(params: {
    organizationId: string;
    number: number;
    userTypes: POLLA_USER_TYPE[];
    parentId?: string | null;
  }): Promise<IPollaUserByNumber> {
    let query = supabase
      .from('polla_users')
      .select('polla_user_id, name, last_name, number, user_type, parent_polla_user_id')
      .eq('polla_organization_id', params.organizationId)
      .eq('number', params.number)
      .in('user_type', params.userTypes)
      .eq('disabled', false)
      .is('deleted_at', null);

    if (params.parentId) query = query.eq('parent_polla_user_id', params.parentId);

    // El número es único por tipo: un pasador y un jugador pueden compartirlo.
    const { data, error } = await query.limit(2);

    throwIfPollaError(error);
    if (!data?.length) throw new NotFoundError('Pasador o jugador con ese número');
    if (data.length > 1) {
      throw new ConflictError('Hay un pasador y un jugador con ese número: buscalo por nombre');
    }

    const user = data[0] as {
      polla_user_id: string;
      name: string;
      last_name: string | null;
      number: number;
      user_type: POLLA_USER_TYPE;
      parent_polla_user_id: string | null;
    };

    const cashierName = user.parent_polla_user_id
      ? (await this.getById(user.parent_polla_user_id)).name
      : user.name;

    return {
      polla_user_id: user.polla_user_id,
      name: user.name,
      last_name: user.last_name,
      number: user.number,
      user_type: user.user_type,
      cashier_name: cashierName,
    };
  }

  /**
   * Buscador de pasadores y jugadores para elegir uno de una lista. Solo
   * dígitos busca el número exacto; cualquier otro texto, en nombre, apellido
   * y usuario; vacío trae todos. Pasadores primero, después por número.
   */
  async search(
    params: { organizationId: string; userTypes: POLLA_USER_TYPE[]; q: string },
    pagination: PollaPagination
  ) {
    let query = supabase
      .from('polla_users')
      // Embebido por columna: así es el pasador del jugador (muchos a uno). Con
      // `polla_users!parent_polla_user_id` PostgREST trae los jugadores del
      // pasador.
      .select(
        'polla_user_id, name, last_name, username, number, user_type, parent:parent_polla_user_id(name, number)',
        pagination.withCount ? { count: 'exact' } : {}
      )
      .eq('polla_organization_id', params.organizationId)
      .in('user_type', params.userTypes)
      .eq('disabled', false)
      .is('deleted_at', null);

    const q = params.q.trim();
    if (/^\d{1,9}$/.test(q)) {
      query = query.eq('number', Number(q));
    } else {
      const searchFilter = ilikeAny(['name', 'last_name', 'username'], q);
      if (searchFilter) query = query.or(searchFilter);
    }

    const { data, error, count } = await query
      .order('user_type', { ascending: true })
      .order('number', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
      .range(pagination.from, pagination.to);

    throwIfPollaError(error);

    const rows = (data ?? []) as unknown as {
      polla_user_id: string;
      name: string;
      last_name: string | null;
      username: string | null;
      number: number;
      user_type: POLLA_USER_TYPE;
      parent: { name: string; number: number | null } | null;
    }[];

    const options: IPollaUserOption[] = rows.map(({ parent, ...user }) => ({
      ...user,
      cashier_name: parent ? parent.name : user.name,
      cashier_number: parent ? parent.number : user.number,
    }));

    return buildPaginated(options, pagination, pagination.withCount ? (count ?? 0) : null);
  }

  /** Capitalista de cada organización pedida (para el listado del OWNER). */
  async getCapitalists(organizationIds: string[]) {
    if (organizationIds.length === 0) return [];

    const { data, error } = await supabase
      .from('polla_users')
      .select('polla_user_id, name, last_name, username, polla_organization_id')
      .eq('user_type', POLLA_USER_TYPE.CAPITALIST)
      .in('polla_organization_id', organizationIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    throwIfPollaError(error);
    return (data ?? []) as {
      polla_user_id: string;
      name: string;
      last_name: string | null;
      username: string | null;
      polla_organization_id: string;
    }[];
  }
}
