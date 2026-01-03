import { IUserEntityBack, USER_TYPE } from '@helper/types/user.type';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';
import { IUpdateUserEntity } from '@helper/request/user.request';

export class UserRepository {
  /**
   * Get all descendant organization IDs (including the org itself)
   * Uses recursive SQL function for efficiency
   */
  async getOrganizationDescendants(organizationId: string): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_organization_descendants', {
      p_org_id: organizationId,
    });

    if (error) throw new Error(error.message);
    return data?.map((d: { organization_id: string }) => d.organization_id) || [organizationId];
  }

  /**
   * Check if an organization is a sub-organization (has a parent)
   */
  async isSubOrganization(organizationId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('organizations')
      .select('parent_organization_id')
      .eq('organization_id', organizationId)
      .single();

    if (error) throw new Error(error.message);
    return data?.parent_organization_id !== null;
  }
  async getById(id: string, organization_id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', id)
      .eq('organization_id', organization_id)
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  /**
   * Get user by ID without organization restriction
   * Used for special cases like OWNER resetting SUPERADMIN password from another org
   */
  async getByIdWithoutOrgRestriction(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getByUsernameAndOrganization(username: string, organization_id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('organization_id', organization_id)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  async getAll(
    organization_id: string,
    user_type: USER_TYPE,
    cashier_number?: number,
    filter_user_type?: USER_TYPE
  ) {
    let query = supabase.from('users').select('*').is('deleted_at', null);

    // Hierarchical permission filtering
    // Hierarchy: OWNER -> CAPITALIST -> SUPERADMIN -> ADMIN -> CASHIER
    if (user_type === USER_TYPE.OWNER) {
      // OWNER can see all users in their organization
      query = query.eq('organization_id', organization_id);

      if (filter_user_type) {
        query = query.eq('user_type', filter_user_type);
      } else {
        // Default: show all except OWNER
        query = query.in('user_type', [
          USER_TYPE.CAPITALIST,
          USER_TYPE.SUPERADMIN,
          USER_TYPE.ADMIN,
          USER_TYPE.CASHIER,
        ]);
      }

      query = query.order('user_type', { ascending: true }).order('number', { ascending: true });
    } else if (user_type === USER_TYPE.CAPITALIST) {
      // CAPITALIST can see all users in their org + all sub-orgs
      const descendantOrgs = await this.getOrganizationDescendants(organization_id);
      query = query.in('organization_id', descendantOrgs);

      if (filter_user_type) {
        // CAPITALIST can see SUPERADMIN, ADMIN, CASHIER
        if ([USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN, USER_TYPE.CASHIER].includes(filter_user_type)) {
          query = query.eq('user_type', filter_user_type);
        } else {
          query = query.in('user_type', [USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN, USER_TYPE.CASHIER]);
        }
      } else {
        query = query.in('user_type', [USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN, USER_TYPE.CASHIER]);
      }

      query = query.order('user_type', { ascending: true }).order('number', { ascending: true });
    } else if (user_type === USER_TYPE.SUPERADMIN) {
      // SUPERADMIN visibility depends on whether they're in a sub-org or main org
      const isSubOrg = await this.isSubOrganization(organization_id);

      if (isSubOrg) {
        // SUPERADMIN in sub-org: only see users in their sub-org
        query = query.eq('organization_id', organization_id);
      } else {
        // SUPERADMIN in main org: see all like CAPITALIST (their org + sub-orgs)
        const descendantOrgs = await this.getOrganizationDescendants(organization_id);
        query = query.in('organization_id', descendantOrgs);
      }

      if (filter_user_type) {
        if ([USER_TYPE.ADMIN, USER_TYPE.CASHIER].includes(filter_user_type)) {
          query = query.eq('user_type', filter_user_type);
        } else {
          query = query.in('user_type', [USER_TYPE.ADMIN, USER_TYPE.CASHIER]);
        }
      } else {
        query = query.in('user_type', [USER_TYPE.ADMIN, USER_TYPE.CASHIER]);
      }

      query = query.order('user_type', { ascending: true }).order('number', { ascending: true });
    } else if (user_type === USER_TYPE.ADMIN) {
      // ADMIN can only see CASHIER from own organization
      query = query
        .eq('organization_id', organization_id)
        .eq('user_type', USER_TYPE.CASHIER)
        .order('number', { ascending: true });
    } else {
      // CASHIER or others - no access (handled in route)
      query = query
        .eq('organization_id', organization_id)
        .eq('user_type', USER_TYPE.CASHIER)
        .order('number', { ascending: true });
    }

    // Filter by number if provided
    if (cashier_number !== undefined && cashier_number !== null) {
      query = query.eq('number', cashier_number);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.details);
    return data || [];
  }

  async create(newUser: IUserEntityBack) {
    const { data, error } = await supabase.from('users').insert(newUser).select().single();

    if (error) throw error;
    return data;
  }

  async update(id: string, payload: IUpdateUserEntity, organization_id: string) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({ ...payload, edited_at: timestamp })
      .eq('user_id', id)
      .eq('organization_id', organization_id)
      .select()
      .single();
    if (error) throw new Error(error.details);
    return data;
  }

  async delete(id: string, organization_id: string) {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({ deleted_at: timestamp })
      .eq('user_id', id)
      .eq('organization_id', organization_id)
      .select()
      .single();
    if (error) throw new Error(error.details);
    return data;
  }

  async deleteFailedUser(id: string) {
    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('user_id', id)
      .select()
      .single();

    if (error) throw new Error(error.details);
    return data;
  }

  /**
   * Assign a user to a group by changing their organization_id
   * Used by CAPITALIST to move users between their organization and sub-orgs
   */
  async assignToGroup(
    userId: string,
    currentOrgId: string,
    targetOrgId: string
  ): Promise<IUserEntityBack> {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({ organization_id: targetOrgId, edited_at: timestamp })
      .eq('user_id', userId)
      .eq('organization_id', currentOrgId)
      .select()
      .single();

    if (error) throw new Error(error.details || error.message);
    return data;
  }

  /**
   * Get users that can be assigned to groups (users in parent org or sibling groups)
   * Returns users from the network that are not in the target group
   */
  async getUsersForGroupAssignment(
    networkOrgIds: string[],
    excludeOrgId?: string
  ): Promise<IUserEntityBack[]> {
    let query = supabase
      .from('users')
      .select('*')
      .in('organization_id', networkOrgIds)
      .is('deleted_at', null)
      .in('user_type', [USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN, USER_TYPE.CASHIER])
      .order('number', { ascending: true });

    if (excludeOrgId) {
      query = query.neq('organization_id', excludeOrgId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.details || error.message);
    return data || [];
  }
}
