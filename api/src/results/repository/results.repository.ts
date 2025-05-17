import { supabase } from '../../../database/db.connection';
import { IGetResultsEntity } from '@helper/request/results.response';

export class ResultsRepository {
  async create(payload: any) {
    const { data, error } = await supabase.from('results').insert(payload).select().single();

    if (error) {
      console.error(error);
      throw new Error(error?.details ?? error.message);
    }
    const { data: results, error: errorResults } = await supabase
      .from('results')
      .select(
        `
    *,
    lottery:lottery_id (
      *
    ),
    schedule:schedule_id (
      *
    )
  `
      )
      .eq('results_id', data.results_id)
      .single();
    if (errorResults) {
      console.error(error);
      throw new Error(errorResults?.details ?? errorResults.message);
    }
    return results;
  }
  async getById(id: string) {
    const { data, error } = await supabase
      .from('results')
      .select(
        `
    *,
    lottery:lottery_id (
      *
    ),
    schedule:schedule_id (
      *
    )
  `
      )
      .eq('results_id', id)
      .single();

    if (error) throw new Error(error.details);
    return data;
  }
  async get(props: IGetResultsEntity) {
    const { data, error } = await supabase
      .from('results')
      .select(
        `
    *,
    lottery:lottery_id (
      *
    ),
    schedule:schedule_id (
      *
    )
  `
      )
      .eq('schedule_id', props.schedule_id)
      .eq('lottery_id', props.lottery_id)
      .eq('date', props.date)
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll() {
    let query = supabase
      .from('results')
      .select(
        `
    *,
    lottery:lottery_id (
      *
    ),
    schedule:schedule_id (
      *
    )
  `
      )
      .order('date', { ascending: true });

    const { data, error } = await query;

    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, payload: any) {
    const { data, error } = await supabase
      .from('results')
      .update(payload)
      .eq('results_id', id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }
}
