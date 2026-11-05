import { supabase } from '@database/db.connection';
import { NotFoundError } from '@helper/errors';
import { IPollaResultEntityBack } from '@helper/polla/types/game.type';
import { throwIfPollaError } from '../../helper/polla-errors';
import { PollaPagination, buildPaginated } from '../../helper/pagination';

export interface PollaResultFilters {
  organizationId: string | null;
  date?: string;
  from?: string;
  to?: string;
  lotteryId?: string | null;
  scheduleId?: string | null;
}

export class PollaResultRepository {
  async getAll(filters: PollaResultFilters, pagination: PollaPagination) {
    let query = supabase
      .from('polla_results')
      .select('*', pagination.withCount ? { count: 'exact' } : {})
      .is('deleted_at', null);

    if (filters.organizationId) query = query.eq('polla_organization_id', filters.organizationId);
    if (filters.date) query = query.eq('date', filters.date);
    if (filters.from) query = query.gte('date', filters.from);
    if (filters.to) query = query.lte('date', filters.to);
    if (filters.lotteryId) query = query.eq('polla_lottery_id', filters.lotteryId);
    if (filters.scheduleId) query = query.eq('polla_schedule_id', filters.scheduleId);

    const { data, error, count } = await query
      .order('date', { ascending: false })
      .range(pagination.from, pagination.to);

    throwIfPollaError(error);
    return buildPaginated(data ?? [], pagination, pagination.withCount ? (count ?? 0) : null);
  }

  async getById(resultId: string): Promise<IPollaResultEntityBack> {
    const { data, error } = await supabase
      .from('polla_results')
      .select('*')
      .eq('polla_result_id', resultId)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Resultado de Polla');
    return data as IPollaResultEntityBack;
  }

  async create(payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('polla_results')
      .insert(payload)
      .select('*')
      .single();

    throwIfPollaError(error);
    return data;
  }

  async update(resultId: string, results: string[]) {
    const { data, error } = await supabase
      .from('polla_results')
      .update({ results, edited_at: new Date().toISOString() })
      .eq('polla_result_id', resultId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Resultado de Polla');
    return data;
  }

  async softDelete(resultId: string) {
    const { data, error } = await supabase
      .from('polla_results')
      .update({ deleted_at: new Date().toISOString() })
      .eq('polla_result_id', resultId)
      .is('deleted_at', null)
      .select('polla_result_id')
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) throw new NotFoundError('Resultado de Polla');
    return data;
  }

  /**
   * Procesa los aciertos del día en todas las ediciones con algún sorteo de
   * ese turno (cada una con todos sus sorteos) y recalcula la cuenta corriente.
   */
  async processDay(organizationId: string, scheduleId: string, date: string) {
    const { data, error } = await supabase.rpc('polla_process_results_and_accounts', {
      p_organization_id: organizationId,
      p_schedule_id: scheduleId,
      p_date: date,
    });

    throwIfPollaError(error);
    return data;
  }

  /**
   * "Definir con lo cargado": el día de la edición cuenta como completo aunque
   * le falte un sorteo (uno que no se hizo), se reprocesa y se recalcula la
   * cuenta corriente. Queda guardado quién lo definió.
   */
  async defineEditionDay(editionId: string, date: string, actorId: string) {
    const { data, error } = await supabase.rpc('polla_define_edition_day', {
      p_edition_id: editionId,
      p_date: date,
      p_actor_id: actorId,
    });

    throwIfPollaError(error);
    return data;
  }
}
