import { supabase } from '@database/db.connection';
import { NotFoundError } from '@helper/errors';
import {
  IPollaEditionEntityBack,
  POLLA_EDITION_PERIOD,
  POLLA_EDITION_STATUS,
} from '@helper/polla/types/game.type';
import { POLLA_USER_TYPE } from '@helper/polla/types/user.type';
import { throwIfPollaError } from '../../helper/polla-errors';
import { PollaPagination, buildPaginated } from '../../helper/pagination';

export interface PollaEditionFilters {
  organizationId: string | null;
  status?: POLLA_EDITION_STATUS;
  /** Ediciones cuyo rango de juego incluye esta fecha. */
  playingOn?: string;
  /** Ediciones cuyo cierre de carga es esta fecha o posterior (sin mirar la hora). */
  loadableOn?: string;
  /** Futuras, jugando y/o pasadas a la fecha `today` (ver `pollaEditionPeriod`). */
  periods?: { list: POLLA_EDITION_PERIOD[]; today: string };
}

/** Condición PostgREST de un período (mismo criterio que `pollaEditionPeriod`). */
const periodFilter = (period: POLLA_EDITION_PERIOD, today: string): string => {
  switch (period) {
    case POLLA_EDITION_PERIOD.UPCOMING:
      return `and(status.eq.${POLLA_EDITION_STATUS.ACTIVE},start_date.gt.${today})`;
    case POLLA_EDITION_PERIOD.PLAYING:
      return `and(status.eq.${POLLA_EDITION_STATUS.ACTIVE},start_date.lte.${today})`;
    case POLLA_EDITION_PERIOD.FINISHED:
      return `status.eq.${POLLA_EDITION_STATUS.FINISHED}`;
  }
};

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
    if (filters.periods) {
      // La fecha sale del servidor y los períodos vienen validados contra el
      // enum: no hay texto del cliente dentro del filtro `or`.
      const { list, today } = filters.periods;
      query = query.or(list.map((period) => periodFilter(period, today)).join(','));
    }

    const { data, error, count } = await query
      .order('start_date', { ascending: false })
      .range(pagination.from, pagination.to);

    throwIfPollaError(error);
    return buildPaginated(data ?? [], pagination, pagination.withCount ? (count ?? 0) : null);
  }

  /**
   * Ediciones donde el rol carga en este momento, cada una con su corte
   * (`my_load_cutoff`). La regla vive en la base (`polla_load_cutoff`).
   */
  async getLoadable(organizationId: string, role: POLLA_USER_TYPE) {
    const { data, error } = await supabase.rpc('polla_loadable_editions', {
      p_organization_id: organizationId,
      p_role: role,
    });

    throwIfPollaError(error);
    return (data ?? []) as (IPollaEditionEntityBack & { my_load_cutoff: string | null })[];
  }

  /**
   * Corte y carga abierta de varias ediciones para el rol: con eso se decide
   * qué jugadas del listado puede editar o borrar.
   */
  async getLoadStates(
    editionIds: string[],
    role: POLLA_USER_TYPE
  ): Promise<{ polla_edition_id: string; load_cutoff: string | null; can_load: boolean }[]> {
    if (editionIds.length === 0) return [];

    const { data, error } = await supabase.rpc('polla_editions_load_state', {
      p_edition_ids: editionIds,
      p_role: role,
    });

    throwIfPollaError(error);
    return data ?? [];
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

  /**
   * Cambios de una edición con sus reglas (`polla_update_edition`): el precio
   * vale para las jugadas nuevas, extender una sin ganador la vuelve a poner
   * en juego, con ganador solo se renombra y con sorteos cargados no se mueven
   * quiniela, turno ni inicio.
   */
  async update(editionId: string, payload: Record<string, unknown>) {
    const { data, error } = await supabase.rpc('polla_update_edition', {
      p_edition_id: editionId,
      p_changes: payload,
    });

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Edición de Polla');
    return data as IPollaEditionEntityBack;
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
