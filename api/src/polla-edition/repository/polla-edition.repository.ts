import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';
import { IPollaEditionEntityBack } from '@helper/types/polla-edition.type';
import {
  INewPollaEditionEntity,
  IUpdatePollaEditionEntity,
} from '@helper/request/polla-edition.request';

export class PollaEditionRepository {
  async getById(id: string, organization_id: string) {
    const { data, error } = await supabase
      .from('polla_editions')
      .select('*')
      .eq('polla_edition_id', id)
      .eq('organization_id', organization_id)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(error.details ?? error.message);
    return data;
  }

  async getAll(organization_id: string, status?: string) {
    let query = supabase
      .from('polla_editions')
      .select('*')
      .eq('organization_id', organization_id)
      .is('deleted_at', null);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('start_date', { ascending: false });
    if (error) throw new Error(error.details ?? error.message);
    return data;
  }

  async create(payload: INewPollaEditionEntity & { organization_id: string }) {
    const { data, error } = await supabase.from('polla_editions').insert(payload).select().single();

    if (error) throw new Error(error.details ?? error.message);
    return data as IPollaEditionEntityBack;
  }

  async update(id: string, payload: IUpdatePollaEditionEntity, organization_id: string) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('polla_editions')
      .update({ ...payload, edited_at: timestamp })
      .eq('polla_edition_id', id)
      .eq('organization_id', organization_id)
      .select()
      .single();

    if (error) throw new Error(error.details ?? error.message);
    return data as IPollaEditionEntityBack;
  }

  async delete(id: string, organization_id: string) {
    const timestamp = dayjs().toISOString();
    const { error } = await supabase
      .from('polla_editions')
      .update({ deleted_at: timestamp })
      .eq('polla_edition_id', id)
      .eq('organization_id', organization_id);

    if (error) throw new Error(error.details ?? error.message);
  }
}
