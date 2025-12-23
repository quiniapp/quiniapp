import dayjs from 'dayjs';
import { supabase } from '@database/db.connection';
import { IGetResultsEntity } from '@helper/request/results.request';
const RESULTS_VIEW = `
  *,
  lottery:lottery_id (*),
  schedule:schedule_id (*)
`;
export class ResultsRepository {
  private baseQuery(organization_id: string) {
    return supabase
      .from('results')
      .select(RESULTS_VIEW)
      .eq('organization_id', organization_id)
      .is('deleted_at', null);
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
      .single();

    if (error) {
      console.error(error);
      throw new Error(error.details ?? error.message);
    }

    return data;
  }

  async getById(id: string, organization_id: string) {
    const { data, error } = await this.baseQuery(organization_id).eq('results_id', id).single();

    if (error) throw new Error(error.details ?? error.message);
    return data;
  }

  async get(props: IGetResultsEntity & { organization_id: string }) {
    const { data, error } = await this.baseQuery(props.organization_id)
      .eq('schedule_id', props.schedule_id)
      .eq('lottery_id', props.lottery_id)
      .eq('date', props.date);

    if (error) throw new Error(error.details ?? error.message);
    return data;
  }

  async getAll(organization_id: string) {
    const { data, error } = await this.baseQuery(organization_id).order('date', {
      ascending: true,
    });

    if (error) throw new Error(error.details ?? error.message);
    return data;
  }

  async update(id: string, payload: any, organization_id: string) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('results')
      .update({ ...payload, edited_at: timestamp })
      .eq('results_id', id)
      .eq('organization_id', organization_id)
      .is('deleted_at', null)
      .select(RESULTS_VIEW)
      .single();

    if (error) throw new Error(error.details ?? error.message);
    return data;
  }

  async delete(id: string, organization_id: string) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('results')
      .update({ deleted_at: timestamp })
      .eq('results_id', id)
      .eq('organization_id', organization_id)
      .select(RESULTS_VIEW)
      .single();

    if (error) throw new Error(error.details ?? error.message);
    return data;
  }
}
