import dayjs from 'dayjs';
import { supabase } from '@database/db.connection';
import { IGetResultsEntity } from '@helper/request/results.response';
const RESULTS_VIEW = `
  *,
  lottery:lottery_id (*),
  schedule:schedule_id (*)
`;
export class ResultsRepository {
  private baseQuery() {
    return supabase.from('results').select(RESULTS_VIEW).is('deleted_at', null);
  }

  async create(payload: any) {
    const { data, error } = await supabase
      .from('results')
      .insert(payload)
      .select(
        `
      *,
      lottery:lottery_id(*),
      schedule:schedule_id(*)
    `
      )
      .single(); // devuelve una sola fila

    if (error) {
      console.error(error);
      throw new Error(error.details ?? error.message);
    }

    return data;
  }

  async getById(id: string) {
    const { data, error } = await this.baseQuery().eq('results_id', id).single();

    if (error) throw new Error(error.details ?? error.message);
    return data;
  }

  async get(props: IGetResultsEntity) {
    const { data, error } = await this.baseQuery()
      .eq('schedule_id', props.schedule_id)
      .eq('lottery_id', props.lottery_id)
      .eq('date', props.date);

    if (error) throw new Error(error.details ?? error.message);
    return data;
  }

  async getAll() {
    const { data, error } = await this.baseQuery().order('date', { ascending: true });

    if (error) throw new Error(error.details ?? error.message);
    return data;
  }

  async update(id: string, payload: any) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('results')
      .update({ ...payload, edited_at: timestamp })
      .eq('results_id', id)
      .is('deleted_at', null) // opcional: evitás editar registros ya eliminados
      .select(RESULTS_VIEW)
      .single();

    if (error) throw new Error(error.details ?? error.message);
    return data;
  }

  /** Soft delete: setea deleted_at */
  async delete(id: string) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('results')
      .update({ deleted_at: timestamp })
      .eq('results_id', id)
      .select(RESULTS_VIEW) // devolvé el registro “borrado”
      .single();

    if (error) throw new Error(error.details ?? error.message);
    return data;
  }
}
