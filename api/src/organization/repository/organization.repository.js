import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';
import { DEFAULT_ORG_ID } from 'envs';
export class OrganizationRepository {
    async getById(id) {
        if (id === DEFAULT_ORG_ID) {
            throw new Error('No se puede consultar la organización por defecto');
        }
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('organization_id', id)
            .is('deleted_at', null)
            .single();
        if (error)
            throw new Error(error.details);
        return data;
    }
    async getAll() {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .is('deleted_at', null)
            .neq('organization_id', DEFAULT_ORG_ID)
            .order('created_at', { ascending: true });
        if (error)
            throw new Error(error.details);
        return data;
    }
    /**
     * Get direct children of an organization (sub-organizations/groups)
     */
    async getChildren(parentOrgId) {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('parent_organization_id', parentOrgId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });
        if (error)
            throw new Error(error.details);
        return data || [];
    }
    /**
     * Get all descendant organization IDs (recursive)
     */
    async getDescendants(orgId) {
        const { data, error } = await supabase.rpc('get_organization_descendants', {
            p_org_id: orgId,
        });
        if (error)
            throw new Error(error.message);
        return data?.map((d) => d.organization_id) || [orgId];
    }
    async create(payload) {
        const { data, error } = await supabase
            .from('organizations')
            .insert({ name: payload.name })
            .select()
            .single();
        if (error)
            throw new Error(error.details);
        return data;
    }
    /**
     * Create a sub-organization (group) under a parent organization
     */
    async createSubOrganization(payload) {
        const { data, error } = await supabase
            .from('organizations')
            .insert({
            name: payload.name,
            parent_organization_id: payload.parent_organization_id,
        })
            .select()
            .single();
        if (error)
            throw new Error(error.details);
        return data;
    }
    /**
     * Inherit configuration from parent organization to new sub-organization
     * Copies lotteries, schedules, and schedule_lotteries
     */
    async inheritConfiguration(parentOrgId, newOrgId) {
        const { error } = await supabase.rpc('inherit_organization_config', {
            p_parent_org_id: parentOrgId,
            p_new_org_id: newOrgId,
        });
        if (error)
            throw new Error(error.message);
    }
    async update(id, payload) {
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
        if (error)
            throw new Error(error.details);
        return data;
    }
    async delete(id) {
        if (id === DEFAULT_ORG_ID) {
            throw new Error('No se puede eliminar la organización por defecto');
        }
        const { error } = await supabase.rpc('hard_delete_organization', {
            p_org_id: id,
        });
        if (error)
            throw error;
    }
}
