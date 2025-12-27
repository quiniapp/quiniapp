import { IOrganizationEntityBack } from '@helper/types/organization.type';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';
import { DEFAULT_ORG_ID } from 'envs';

export class OrganizationRepository {
  async getById(id: string): Promise<IOrganizationEntityBack> {
    if (id === DEFAULT_ORG_ID) {
      throw new Error('No se puede consultar la organización por defecto');
    }

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
      .neq('organization_id', DEFAULT_ORG_ID)
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
    if (id === DEFAULT_ORG_ID) {
      throw new Error('No se puede actualizar la organización por defecto');
    }

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
    if (id === DEFAULT_ORG_ID) {
      throw new Error('No se puede eliminar la organización por defecto');
    }

    const { error } = await supabase.rpc('hard_delete_organization', {
      p_org_id: id,
    });

    if (error) throw error;
  }
}
