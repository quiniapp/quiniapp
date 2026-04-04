import { IUserEntityBack, USER_TYPE } from '@helper/types/user.type';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';
import { IUpdateUserEntity } from '@helper/request/user.request';
import { globalCacheManager } from '../../cache/CacheManager';

const ORG_NETWORK_IDS_TTL = 10 * 60 * 1000; // 10 minutes

export class UserRepository {
  /**
   * Get all descendant organization IDs (including the org itself)
   * Uses recursive SQL function for efficiency
   */
  /**
   * Check if a group (sub-org) belongs to the given root organization.
   * Queries the DB directly — no cache — so newly created groups are always found.
   */
  async isGroupInOrganization(groupId: string, organizationId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('organizations')
      .select('organization_id')
      .eq('organization_id', groupId)
      .eq('parent_organization_id', organizationId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data !== null;
  }

  async getOrganizationDescendants(organizationId: string): Promise<string[]> {
    const cacheKey = `org:${organizationId}:network-ids`;
    const cached = globalCacheManager.get<string[]>(cacheKey);
    if (cached) return cached.payload;

    const { data, error } = await supabase.rpc('get_organization_descendants', {
      p_org_id: organizationId,
    });

    if (error) throw new Error(error.message);
    const descendantIds = (data || []).map((d: { organization_id: string }) => d.organization_id);
    const result = [organizationId, ...descendantIds];
    globalCacheManager.set(cacheKey, result, { ttl: ORG_NETWORK_IDS_TTL });
    return result;
  }

  async getUserIdsByOrg(organizationId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('users')
      .select('user_id')
      .eq('organization_id', organizationId)
      .is('deleted_at', null);
    if (error) throw new Error(error.message);
    return data?.map((u: { user_id: string }) => u.user_id) ?? [];
  }

  /**
   * Get the parent organization ID of a given organization (group)
   */
  async getParentOrganizationId(organizationId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('parent_organization_id')
      .eq('organization_id', organizationId)
      .single();

    if (error) throw new Error(error.message);
    return data?.parent_organization_id ?? null;
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
  // Common select fields (all user fields including sensitive ones for backend operations)
  private readonly allUserFields = `
    user_id,
    number,
    user_type,
    name,
    last_name,
    address,
    phone,
    email,
    username,
    disabled,
    organization_id,
    group_id,
    created_at,
    edited_at,
    deleted_at,
    cashier_type,
    fee,
    fee_plus,
    password_hash,
    password_changed_at,
    password_reset_required,
    failed_login_attempts,
    locked_until,
    last_login_at,
    last_login_ip
  `
    .replace(/\s+/g, ' ')
    .trim();

  async getById(id: string, organization_id: string): Promise<IUserEntityBack> {
    const { data, error } = await supabase
      .from('users')
      .select(this.allUserFields)
      .eq('user_id', id)
      .eq('organization_id', organization_id)
      .single();

    if (error) throw new Error(error.details || error.message || JSON.stringify(error));
    return data as unknown as IUserEntityBack;
  }

  /**
   * Get user by ID without organization restriction
   * Used for special cases like OWNER resetting SUPERADMIN password from another org
   */
  async getByIdWithoutOrgRestriction(id: string): Promise<IUserEntityBack> {
    const { data, error } = await supabase
      .from('users')
      .select(this.allUserFields)
      .eq('user_id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(error.details || error.message || JSON.stringify(error));
    return data as unknown as IUserEntityBack;
  }

  async getByUsernameAndOrganization(
    username: string,
    organization_id: string
  ): Promise<IUserEntityBack> {
    const { data, error } = await supabase
      .from('users')
      .select(this.allUserFields)
      .eq('username', username)
      .eq('organization_id', organization_id)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(error.details || error.message || JSON.stringify(error));
    return data as unknown as IUserEntityBack;
  }

  async getAll(
    organization_id: string,
    user_type: USER_TYPE,
    requesting_user_group_id: string,
    cashier_number?: number,
    filter_user_type?: USER_TYPE,
    filter_group_id?: string,
    include_session?: boolean
  ): Promise<IUserEntityBack[]> {
    const selectFields = include_session
      ? `${this.allUserFields}, sessions(last_activity_at)`
      : this.allUserFields;

    let query = supabase
      .from('users')
      .select(selectFields)
      .eq('organization_id', organization_id)
      .is('deleted_at', null);

    if (include_session) {
      query = query
        .eq('sessions.is_active', true)
        .order('last_activity_at', { foreignTable: 'sessions', ascending: false })
        .limit(1, { foreignTable: 'sessions' });
    }

    // 1) user_type determines WHAT types are visible
    const visibleTypes = this.getVisibleUserTypes(user_type, filter_user_type);
    if (visibleTypes.length === 1) {
      query = query.eq('user_type', visibleTypes[0]);
    } else {
      query = query.in('user_type', visibleTypes);
    }

    // 2) group_id determines SCOPE
    const hasGroup = requesting_user_group_id !== organization_id;
    if (hasGroup) {
      // User is in a specific group: only see users in their group
      query = query.eq('group_id', requesting_user_group_id);
    } else if (filter_group_id) {
      // No group restriction but UI requested a group filter
      query = query.eq('group_id', filter_group_id);
    }

    // Filter by cashier number if provided
    if (cashier_number !== undefined && cashier_number !== null) {
      query = query.eq('number', cashier_number);
    }

    query = query.order('user_type', { ascending: true }).order('number', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(error.details || error.message || JSON.stringify(error));
    }
    return (data as unknown as IUserEntityBack[]) || [];
  }

  /**
   * Get the visible user types for a given requesting user_type.
   * Respects filter_user_type if within the allowed set.
   */
  private getVisibleUserTypes(user_type: USER_TYPE, filter_user_type?: USER_TYPE): USER_TYPE[] {
    let allowed: USER_TYPE[];
    switch (user_type) {
      case USER_TYPE.OWNER:
        allowed = [USER_TYPE.CAPITALIST, USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN, USER_TYPE.CASHIER];
        break;
      case USER_TYPE.CAPITALIST:
        allowed = [USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN, USER_TYPE.CASHIER];
        break;
      case USER_TYPE.SUPERADMIN:
        allowed = [USER_TYPE.ADMIN, USER_TYPE.CASHIER];
        break;
      case USER_TYPE.ADMIN:
        allowed = [USER_TYPE.CASHIER];
        break;
      default:
        allowed = [USER_TYPE.CASHIER];
        break;
    }

    if (filter_user_type && allowed.includes(filter_user_type)) {
      return [filter_user_type];
    }
    return allowed;
  }

  async create(newUser: IUserEntityBack): Promise<IUserEntityBack> {
    const { data, error } = await supabase.from('users').insert(newUser).select().single();

    if (error) throw error;
    return data as unknown as IUserEntityBack;
  }

  async update(
    id: string,
    payload: IUpdateUserEntity,
    organization_id: string
  ): Promise<IUserEntityBack> {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({ ...payload, edited_at: timestamp })
      .eq('user_id', id)
      .eq('organization_id', organization_id)
      .select()
      .single();
    if (error) throw new Error(error.details || error.message || JSON.stringify(error));
    return data as unknown as IUserEntityBack;
  }

  async delete(id: string, organization_id: string): Promise<IUserEntityBack> {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({ deleted_at: timestamp })
      .eq('user_id', id)
      .eq('organization_id', organization_id)
      .select()
      .single();
    if (error) throw new Error(error.details || error.message || JSON.stringify(error));
    return data as unknown as IUserEntityBack;
  }

  async deleteFailedUser(id: string) {
    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('user_id', id)
      .select()
      .single();

    if (error) throw new Error(error.details || error.message || JSON.stringify(error));
    return data;
  }

  /**
   * Assign a user to a group by setting their group_id field.
   * organization_id is NOT changed — it always stays as the root org.
   */
  async assignToGroup(
    userId: string,
    orgId: string,
    targetGroupId: string
  ): Promise<IUserEntityBack> {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({ group_id: targetGroupId, edited_at: timestamp })
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw new Error(error.details || error.message);
    return data;
  }

  /**
   * Remove a user from a group by setting group_id = organization_id (no group).
   * organization_id is NOT changed.
   */
  async removeFromGroup(
    userId: string,
    groupId: string,
    organizationId: string
  ): Promise<IUserEntityBack> {
    const timestamp = dayjs().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({ group_id: organizationId, edited_at: timestamp })
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .select()
      .single();

    if (error) throw new Error(error.details || error.message);
    return data;
  }

  /**
   * Get users available for group assignment.
   * Unassigned = group_id equals organization_id.
   * Only ADMIN and CASHIER are assignable to groups.
   */
  async getUsersForGroupAssignment(orgId: string): Promise<IUserEntityBack[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', orgId)
      .eq('group_id', orgId)
      .is('deleted_at', null)
      .in('user_type', [USER_TYPE.ADMIN, USER_TYPE.CASHIER])
      .order('number', { ascending: true });

    if (error) throw new Error(error.details || error.message);
    return data || [];
  }

  /**
   * Get user IDs belonging to a specific group within an organization.
   */
  async getUserIdsByGroupId(groupId: string, orgId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('users')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('organization_id', orgId)
      .is('deleted_at', null);

    if (error) throw new Error(error.details || error.message);
    return data?.map((u: { user_id: string }) => u.user_id) ?? [];
  }
}
