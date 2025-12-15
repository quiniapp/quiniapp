import { IOrganizationEntityBack } from '@helper/types/organization.type';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';

export class OrganizationRepository {
  async getById(id: string): Promise<IOrganizationEntityBack> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('organization_id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll(): Promise<IOrganizationEntityBack[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.details);
    return data;
  }

  async create(payload: { name: string }): Promise<IOrganizationEntityBack> {
    const { data, error } = await supabase
      .from('organizations')
      .insert({ name: payload.name })
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async update(id: string, payload: Partial<{ name: string }>): Promise<IOrganizationEntityBack> {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('organizations')
      .update({ ...payload, edited_at: timestamp })
      .eq('organization_id', id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async delete(id: string): Promise<void> {
    const timestamp = dayjs().toISOString();
    const { error } = await supabase
      .from('organizations')
      .update({ deleted_at: timestamp })
      .eq('organization_id', id);

    if (error) throw new Error(error.details);
  }
}
