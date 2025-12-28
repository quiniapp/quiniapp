import { IUserEntityBack, USER_TYPE } from '@helper/types/user.type';
import { supabase } from '@database/db.connection';
import dayjs from 'dayjs';

export class UserRepository {
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
    if (user_type === USER_TYPE.OWNER) {
      // OWNER can see SUPERADMIN (any org), ADMIN/CASHIER (own org)
      query = query.eq('organization_id', organization_id);

      // If filter is provided, apply it
      if (filter_user_type) {
        query = query.eq('user_type', filter_user_type);
      } else {
        // Default: show all except OWNER
        query = query.in('user_type', [USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN, USER_TYPE.CASHIER]);
      }

      query = query.order('user_type', { ascending: true }).order('number', { ascending: true });
    } else if (user_type === USER_TYPE.SUPERADMIN) {
      // SUPERADMIN can see ADMIN/CASHIER from own organization
      query = query.eq('organization_id', organization_id);

      if (filter_user_type) {
        // Validate filter is allowed (ADMIN or CASHIER only)
        if ([USER_TYPE.ADMIN, USER_TYPE.CASHIER].includes(filter_user_type)) {
          query = query.eq('user_type', filter_user_type);
        } else {
          // Default to CASHIER if invalid filter
          query = query.eq('user_type', USER_TYPE.CASHIER);
        }
      } else {
        // Default: show ADMIN and CASHIER
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

  async update(id: string, payload: any, organization_id: string) {
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
}
