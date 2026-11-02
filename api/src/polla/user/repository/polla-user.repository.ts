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
import { ilikeAny, searchCashierCode, searchNumber } from '../../helper/search';

/** Nunca se devuelven hacia afuera las columnas sensibles de auth. */
const PUBLIC_COLUMNS =
  'polla_user_id, number, user_type, name, last_name, phone, email, username, password_reset_required, locked_until, last_login_at, polla_organization_id, polla_group_id, parent_polla_user_id, is_street, fee, fee_plus, disabled, created_at, edited_at';

/** Grupo que no existe: un filtro por él no trae a nadie. */
const NO_GROUP = '00000000-0000-0000-0000-000000000000';

/**
 * Dónde no se puede repetir un número: el pasador, dentro de su grupo (los sin
 * grupo, entre ellos); el jugador, dentro de su pasador.
 */
export type PollaNumberScope =
  | { userType: POLLA_USER_TYPE.CASHIER; groupId: string | null }
  | { userType: POLLA_USER_TYPE.PLAYER; parentId: string };

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
    // Solo dígitos busca el número exacto; `2-5`, el pasador 5 del grupo 2;
    // otro texto, en nombre, apellido y usuario.
    const searchedNumber = filters.search ? searchNumber(filters.search) : null;
    const searchedCode = filters.search ? searchCashierCode(filters.search) : null;
    if (searchedNumber !== null) {
      query = query.eq('number', searchedNumber);
    } else if (searchedCode) {
      const groupId = await this.groupIdByNumber(filters.organizationId, searchedCode.group);
      query = query.eq('user_type', POLLA_USER_TYPE.CASHIER).eq('number', searchedCode.number);
      query = groupId ? query.eq('polla_group_id', groupId) : query.is('polla_group_id', null);
    } else if (filters.search) {
      const searchFilter = ilikeAny(['name', 'last_name', 'username'], filters.search);
      if (searchFilter) query = query.or(searchFilter);
    }
    if (!filters.includeDisabled) {
      query = query.eq('disabled', false);
    }

    // Agrupado por tipo; pasadores y jugadores, de menor a mayor número.
    const { data, error, count } = await query
      .order('user_type', { ascending: true })
      .order('number', { ascending: true, nullsFirst: false })
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

  /**
   * Grupo activo de la organización con ese número; `null` para el 0 (sin
   * grupo). Un número que no existe no trae a nadie.
   */
  private async groupIdByNumber(organizationId: string | null, groupNumber: number) {
    if (groupNumber === 0) return null;

    let query = supabase
      .from('polla_groups')
      .select('polla_group_id')
      .eq('number', groupNumber)
      .is('deleted_at', null);
    if (organizationId) query = query.eq('polla_organization_id', organizationId);

    const { data, error } = await query.limit(1).maybeSingle();
    throwIfPollaError(error);
    // Un uuid que no existe: el filtro no trae a nadie.
    return (data as { polla_group_id: string } | null)?.polla_group_id ?? NO_GROUP;
  }

  /** Usuarios activos del ámbito del número (ver `PollaNumberScope`). */
  private numberScopeQuery(
    organizationId: string,
    scope: PollaNumberScope,
    columns: string,
    options?: { count: 'exact'; head: true }
  ) {
    let query = supabase
      .from('polla_users')
      .select(columns, options)
      .eq('polla_organization_id', organizationId)
      .eq('user_type', scope.userType)
      .is('deleted_at', null);

    if (scope.userType === POLLA_USER_TYPE.PLAYER) {
      query = query.eq('parent_polla_user_id', scope.parentId);
    } else if (scope.groupId) {
      query = query.eq('polla_group_id', scope.groupId);
    } else {
      query = query.is('polla_group_id', null);
    }

    return query;
  }

  /** Si otro usuario activo de su ámbito ya usa ese número. */
  async isNumberTaken(params: {
    organizationId: string;
    scope: PollaNumberScope;
    number: number;
    excludeId?: string;
  }) {
    let query = this.numberScopeQuery(params.organizationId, params.scope, 'polla_user_id', {
      count: 'exact',
      head: true,
    }).eq('number', params.number);

    if (params.excludeId) query = query.neq('polla_user_id', params.excludeId);

    const { count, error } = await query;

    throwIfPollaError(error);
    return (count ?? 0) > 0;
  }

  /** Siguiente número libre del ámbito (1 a N), para precargar el alta. */
  async nextNumber(organizationId: string, scope: PollaNumberScope): Promise<number> {
    const { data, error } = await this.numberScopeQuery(organizationId, scope, 'number')
      .not('number', 'is', null)
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle();

    throwIfPollaError(error);
    return ((data as { number: number } | null)?.number ?? 0) + 1;
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
    groupId?: string | null;
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
    if (params.groupId) query = query.eq('polla_group_id', params.groupId);

    // Los números se repiten entre tipos, grupos y pasadores.
    const { data, error } = await query.limit(2);

    throwIfPollaError(error);
    if (!data?.length) throw new NotFoundError('Pasador o jugador con ese número');
    if (data.length > 1) {
      throw new ConflictError('Hay más de un usuario con ese número: buscalo por nombre');
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
   * dígitos busca el número exacto (puede haber varios: se repiten entre
   * grupos y pasadores); `2-5`, el pasador 5 del grupo 2; cualquier otro
   * texto, en nombre, apellido y usuario; vacío trae todos. Ordenado por
   * número; si un pasador y un jugador lo comparten, el pasador primero.
   */
  async search(
    params: {
      organizationId: string;
      userTypes: POLLA_USER_TYPE[];
      q: string;
      /** Solo los de ese grupo. */
      groupId?: string | null;
      /** Solo los jugadores de ese pasador. */
      parentId?: string | null;
    },
    pagination: PollaPagination
  ) {
    let query = supabase
      .from('polla_users')
      // Embebido por columna: así es el pasador del jugador (muchos a uno). Con
      // `polla_users!parent_polla_user_id` PostgREST trae los jugadores del
      // pasador.
      // El grupo del jugador es el de su pasador (lo sincroniza la base).
      .select(
        'polla_user_id, name, last_name, username, number, user_type, is_street, parent:parent_polla_user_id(name, number), grp:polla_group_id(number)',
        pagination.withCount ? { count: 'exact' } : {}
      )
      .eq('polla_organization_id', params.organizationId)
      .in('user_type', params.userTypes)
      .eq('disabled', false)
      .is('deleted_at', null);

    if (params.groupId) query = query.eq('polla_group_id', params.groupId);
    if (params.parentId) query = query.eq('parent_polla_user_id', params.parentId);

    const searchedNumber = searchNumber(params.q);
    const searchedCode = searchCashierCode(params.q);
    if (searchedNumber !== null) {
      query = query.eq('number', searchedNumber);
    } else if (searchedCode) {
      const groupId = await this.groupIdByNumber(params.organizationId, searchedCode.group);
      query = query.eq('user_type', POLLA_USER_TYPE.CASHIER).eq('number', searchedCode.number);
      query = groupId ? query.eq('polla_group_id', groupId) : query.is('polla_group_id', null);
    } else {
      const searchFilter = ilikeAny(['name', 'last_name', 'username'], params.q);
      if (searchFilter) query = query.or(searchFilter);
    }

    const { data, error, count } = await query
      .order('number', { ascending: true, nullsFirst: false })
      .order('user_type', { ascending: true })
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
      is_street: boolean;
      parent: { name: string; number: number | null } | null;
      grp: { number: number } | null;
    }[];

    const options: IPollaUserOption[] = rows.map(({ parent, grp, ...user }) => ({
      ...user,
      cashier_name: parent ? parent.name : user.name,
      cashier_number: parent ? parent.number : user.number,
      group_number: grp?.number ?? null,
    }));

    return buildPaginated(options, pagination, pagination.withCount ? (count ?? 0) : null);
  }

  /** Admin de cada grupo pedido (para el listado de Grupos). */
  async getGroupAdmins(groupIds: string[]) {
    if (groupIds.length === 0) return [];

    const { data, error } = await supabase
      .from('polla_users')
      .select('polla_user_id, name, last_name, username, polla_group_id')
      .eq('user_type', POLLA_USER_TYPE.ADMIN)
      .in('polla_group_id', groupIds)
      .is('deleted_at', null);

    throwIfPollaError(error);
    return (data ?? []) as {
      polla_user_id: string;
      name: string;
      last_name: string | null;
      username: string | null;
      polla_group_id: string;
    }[];
  }

  /** Admins del modelo anterior, sin grupo: se asignan desde Grupos. */
  async getAdminsWithoutGroup(organizationId: string) {
    const { data, error } = await supabase
      .from('polla_users')
      .select('polla_user_id, name, last_name, username')
      .eq('polla_organization_id', organizationId)
      .eq('user_type', POLLA_USER_TYPE.ADMIN)
      .is('polla_group_id', null)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    throwIfPollaError(error);
    return (data ?? []) as {
      polla_user_id: string;
      name: string;
      last_name: string | null;
      username: string | null;
    }[];
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
