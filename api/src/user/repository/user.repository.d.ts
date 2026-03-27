import { IUserEntityBack, USER_TYPE } from '@helper/types/user.type';
import { IUpdateUserEntity } from '@helper/request/user.request';
export declare class UserRepository {
  /**
   * Get all descendant organization IDs (including the org itself)
   * Uses recursive SQL function for efficiency
   */
  getOrganizationDescendants(organizationId: string): Promise<string[]>;
  /**
   * Check if an organization is a sub-organization (has a parent)
   */
  isSubOrganization(organizationId: string): Promise<boolean>;
  private readonly allUserFields;
  getById(id: string, organization_id: string): Promise<IUserEntityBack>;
  /**
   * Get user by ID without organization restriction
   * Used for special cases like OWNER resetting SUPERADMIN password from another org
   */
  getByIdWithoutOrgRestriction(id: string): Promise<IUserEntityBack>;
  getByUsernameAndOrganization(username: string, organization_id: string): Promise<IUserEntityBack>;
  getAll(
    organization_id: string,
    user_type: USER_TYPE,
    cashier_number?: number,
    filter_user_type?: USER_TYPE,
    include_session?: boolean
  ): Promise<IUserEntityBack[]>;
  create(newUser: IUserEntityBack): Promise<IUserEntityBack>;
  update(id: string, payload: IUpdateUserEntity, organization_id: string): Promise<IUserEntityBack>;
  delete(id: string, organization_id: string): Promise<IUserEntityBack>;
  deleteFailedUser(id: string): Promise<any>;
  /**
   * Assign a user to a group by changing their organization_id
   * Used by CAPITALIST to move users between their organization and sub-orgs
   */
  assignToGroup(
    userId: string,
    currentOrgId: string,
    targetOrgId: string
  ): Promise<IUserEntityBack>;
  /**
   * Get users that can be assigned to groups (users in parent org or sibling groups)
   * Returns users from the network that are not in the target group
   */
  getUsersForGroupAssignment(
    networkOrgIds: string[],
    excludeOrgId?: string
  ): Promise<IUserEntityBack[]>;
}
