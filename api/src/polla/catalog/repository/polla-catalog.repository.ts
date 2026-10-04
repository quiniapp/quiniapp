import { supabase } from '@database/db.connection';
import { NotFoundError } from '@helper/errors';
import { throwIfPollaError } from '../../helper/polla-errors';
import { PollaPagination, buildPaginated } from '../../helper/pagination';

export interface CatalogTableConfig {
  table: string;
  idColumn: string;
  /** Las organizaciones no cuelgan de otra organización; el resto sí. */
  orgScoped: boolean;
  orderBy: { column: string; ascending: boolean };
}

export interface CatalogListFilters {
  organizationId: string | null;
  active?: boolean;
  search?: string;
}

/**
 * CRUD genérico de los catálogos de Polla (organizaciones, grupos, quinielas,
 * turnos): las cuatro tablas comparten forma, así que comparten repositorio.
 */
export class PollaCatalogRepository {
  private config: CatalogTableConfig;

  constructor(config: CatalogTableConfig) {
    this.config = config;
  }

  async getAll(filters: CatalogListFilters, pagination: PollaPagination) {
    let query = supabase
      .from(this.config.table)
      .select('*', pagination.withCount ? { count: 'exact' } : {})
      .is('deleted_at', null);

    if (filters.organizationId) {
      // En las tablas con scope el filtro es por la FK; en polla_organizations
      // la "organización" ES la fila, así que el filtro cae sobre su propia PK.
      query = query.eq(
        this.config.orgScoped ? 'polla_organization_id' : this.config.idColumn,
        filters.organizationId
      );
    }

    if (filters.active !== undefined) {
      query = query.eq('active', filters.active);
    }

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const { data, error, count } = await query
      .order(this.config.orderBy.column, { ascending: this.config.orderBy.ascending })
      .range(pagination.from, pagination.to);

    throwIfPollaError(error);

    return buildPaginated(data ?? [], pagination, pagination.withCount ? (count ?? 0) : null);
  }

  async getById(id: string) {
    const { data, error } = await supabase
      .from(this.config.table)
      .select('*')
      .eq(this.config.idColumn, id)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError(this.config.table);
    return data;
  }

  async create(payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from(this.config.table)
      .insert(payload)
      .select('*')
      .single();

    throwIfPollaError(error);
    return data;
  }

  async update(id: string, payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from(this.config.table)
      .update({ ...payload, edited_at: new Date().toISOString() })
      .eq(this.config.idColumn, id)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError(this.config.table);
    return data;
  }

  async softDelete(id: string) {
    const { data, error } = await supabase
      .from(this.config.table)
      .update({ deleted_at: new Date().toISOString() })
      .eq(this.config.idColumn, id)
      .is('deleted_at', null)
      .select(this.config.idColumn)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError(this.config.table);
    return data;
  }

  /** Verifica que el registro pertenezca a la organización del request. */
  async assertBelongsToOrganization(id: string, organizationId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from(this.config.table)
      .select('polla_organization_id')
      .eq(this.config.idColumn, id)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError(this.config.table);

    return (data as { polla_organization_id: string }).polla_organization_id === organizationId;
  }
}
