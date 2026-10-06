import { supabase } from '@database/db.connection';
import { NotFoundError } from '@helper/errors';
import { IPollaEditionEntityBack, POLLA_EDITION_STATUS } from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';
import { PollaPagination, buildPaginated } from '../../helper/pagination';

export interface PollaEditionFilters {
  organizationId: string | null;
  status?: POLLA_EDITION_STATUS;
  /** Ediciones cuyo rango de juego incluye esta fecha. */
  playingOn?: string;
  /** Ediciones que todavía aceptan carga a esta fecha. */
  loadableOn?: string;
}

export class PollaEditionRepository {
  async getAll(filters: PollaEditionFilters, pagination: PollaPagination) {
    let query = supabase
      .from('polla_editions')
      .select('*', pagination.withCount ? { count: 'exact' } : {})
      .is('deleted_at', null);

    if (filters.organizationId) {
      query = query.eq('polla_organization_id', filters.organizationId);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.playingOn) {
      query = query.lte('start_date', filters.playingOn).gte('end_date', filters.playingOn);
    }
    if (filters.loadableOn) {
      query = query.gte('load_limit_date', filters.loadableOn);
    }

    const { data, error, count } = await query
      .order('start_date', { ascending: false })
      .range(pagination.from, pagination.to);

    throwIfPollaError(error);
    return buildPaginated(data ?? [], pagination, pagination.withCount ? (count ?? 0) : null);
  }

  async getById(editionId: string): Promise<IPollaEditionEntityBack> {
    const { data, error } = await supabase
      .from('polla_editions')
      .select('*')
      .eq('polla_edition_id', editionId)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Edición de Polla');
    return data as IPollaEditionEntityBack;
  }

  async create(payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('polla_editions')
      .insert(payload)
      .select('*')
      .single();

    throwIfPollaError(error);
    return data;
  }

  async update(editionId: string, payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('polla_editions')
      .update({ ...payload, edited_at: new Date().toISOString() })
      .eq('polla_edition_id', editionId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Edición de Polla');
    return data;
  }

  /**
   * Borra la edición y anula sus jugadas (si no, la cuenta corriente las sigue
   * sumando en el pase) y recalcula las cuentas afectadas. No borra una
   * edición con ganadores.
   */
  async remove(editionId: string, actorId: string) {
    const { data, error } = await supabase.rpc('polla_delete_edition', {
      p_edition_id: editionId,
      p_actor_id: actorId,
    });

    throwIfPollaError(error);
    return data as { success: boolean; voided_bets: number };
  }
}
