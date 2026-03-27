import {
  IDeleteUserEntity,
  IGetUserEntity,
  INewUserEntity,
  IUpdateUserEntity,
} from '@helper/request/user.request';
import { IUserEntityFront, IUserWithSessionFront, USER_TYPE } from '@helper/types/user.type';
export declare class UserController {
  private repository;
  /**
   * Check if admin user can manage target user based on hierarchy
   * Returns true if admin has higher privilege than target
   */
  canManageUser: (adminType: USER_TYPE, targetType: USER_TYPE) => boolean;
  create: (newUser: INewUserEntity, organization_id: string) => Promise<IUserEntityFront>;
  get: (props: IGetUserEntity, organization_id: string) => Promise<IUserEntityFront>;
  /**
   * Get a user by ID verifying they belong to the admin's network.
   * Used by CAPITALIST/OWNER to access users across sub-orgs.
   * Returns the raw entity (including organization_id) for callers that need it.
   */
  getByIdFromNetwork: (
    userId: string,
    adminOrgId: string
  ) => Promise<
    IUserEntityFront & {
      organization_id: string;
    }
  >;
  getAll(
    organization_id: string,
    user_type: USER_TYPE,
    cashier_number?: number,
    filter_user_type?: USER_TYPE,
    include_session?: boolean
  ): Promise<IUserEntityFront[] | IUserWithSessionFront[]>;
  update: (
    user_id: string,
    props: IUpdateUserEntity,
    organization_id: string
  ) => Promise<IUserEntityFront>;
  delete: (
    props: IDeleteUserEntity,
    organization_id: string
  ) => Promise<IUserEntityFront | IUserWithSessionFront>;
  /**
   * Validate that a user exists and is CAPITALIST of the specified organization
   * Used by OWNER when resetting CAPITALIST passwords from organizations page
   */
  validateCapitalist: (
    username: string,
    organization_id: string,
    adminUserType: USER_TYPE
  ) => Promise<{
    user_id: string;
    username: string;
  }>;
  /**
   * Admin password reset with hierarchical permissions
   * @param targetUserId - User ID whose password will be reset
   * @param adminUserId - Admin user ID performing the reset
   * @param adminUserType - Admin user type (for permission check)
   * @param adminOrgId - Admin's organization ID
   * @param newPassword - Optional new password (if not provided, generates random)
   * @returns Object with the new password
   *
   * Permission Rules (hierarchy: OWNER -> CAPITALIST -> SUPERADMIN -> ADMIN -> CASHIER):
   * - OWNER: Can reset CAPITALIST (any org), SUPERADMIN/ADMIN/CASHIER (own org only)
   * - CAPITALIST: Can reset SUPERADMIN/ADMIN/CASHIER (own org + sub-orgs)
   * - SUPERADMIN: Can reset ADMIN/CASHIER (own org/group only)
   * - ADMIN: Can reset CASHIER (own org only)
   * - CASHIER: Cannot reset passwords (use changePassword instead)
   */
  resetPassword: (
    targetUserId: string,
    adminUserId: string,
    adminUserType: USER_TYPE,
    adminOrgId: string,
    newPassword?: string
  ) => Promise<{
    password: string;
  }>;
  /**
   * User self-service password change
   * @param userId - User ID changing password
   * @param currentPassword - Current password (for verification)
   * @param newPassword - New password
   * @param organization_id - Organization ID
   */
  changePassword: (
    userId: string,
    currentPassword: string,
    newPassword: string,
    organization_id: string
  ) => Promise<void>;
  /**
   * Unlock a user account (admins only, not cashiers)
   * Resets locked_until and failed_login_attempts
   * @param targetUserId - User ID whose account will be unlocked
   * @param adminUserId - Admin user ID performing the unlock
   * @param adminUserType - Admin user type (for permission check)
   * @param adminName - Admin user name (for audit log)
   * @param adminOrgId - Admin's organization ID
   * @param ipAddress - Request IP address
   * @param userAgent - Request user agent
   */
  unlockAccount: (
    targetUserId: string,
    adminUserId: string,
    adminUserType: USER_TYPE,
    adminName: string,
    adminOrgId: string,
    ipAddress?: string,
    userAgent?: string
  ) => Promise<void>;
  /**
   * Get all organization IDs in the network (for permission checks)
   */
  getNetworkOrgIds: (organizationId: string) => Promise<string[]>;
  /**
   * Assign a user to a group (change their organization_id)
   * Only CAPITALIST and OWNER can assign users to groups
   */
  assignUserToGroup: (
    userId: string,
    targetGroupId: string,
    adminOrgId: string,
    adminUserType: USER_TYPE
  ) => Promise<IUserEntityFront>;
  /**
   * Get users available for assignment to groups
   * Returns users from the network (excluding those already in the target group)
   */
  getUsersForGroupAssignment: (
    adminOrgId: string,
    adminUserType: USER_TYPE,
    excludeGroupId?: string
  ) => Promise<IUserEntityFront[]>;
}
