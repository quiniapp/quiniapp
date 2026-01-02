import { UserRepository } from '../repository/user.repository';
import {
  IDeleteUserEntity,
  IGetUserEntity,
  INewUserEntity,
  IUpdateUserEntity,
} from '@helper/request/user.request';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { parseUser } from '../helper/parseUser';
import { buildUserForDB } from '../helper/userBase';
import { UnauthorizedError, BadRequestError, ForbiddenError } from '@helper/errors';
import {
  hashPassword,
  generateRandomPassword,
  validatePasswordStrength,
  comparePassword,
} from 'api/helper/password';
import { SessionRepository } from 'api/src/session/repository/session.repository';
import { AuditRepository } from 'api/src/session/repository/audit.repository';
import { AuthRepository } from 'api/src/auth/repository/auth.repository';
// import { generateEmail } from 'helper/generateEmail';

// User hierarchy levels for permission checks
// Lower number = higher privilege
const USER_HIERARCHY: Record<USER_TYPE, number> = {
  [USER_TYPE.OWNER]: 0,
  [USER_TYPE.CAPITALIST]: 1,
  [USER_TYPE.SUPERADMIN]: 2,
  [USER_TYPE.ADMIN]: 3,
  [USER_TYPE.CASHIER]: 4,
};

export class UserController {
  private repository = new UserRepository();

  /**
   * Check if admin user can manage target user based on hierarchy
   * Returns true if admin has higher privilege than target
   */
  canManageUser = (adminType: USER_TYPE, targetType: USER_TYPE): boolean => {
    return USER_HIERARCHY[adminType] < USER_HIERARCHY[targetType];
  };

  create = async (newUser: INewUserEntity, organization_id: string): Promise<IUserEntityFront> => {
    const user = await buildUserForDB(newUser, organization_id);
    const result = await this.repository.create(user);

    return parseUser(result);
  };
  get = async (props: IGetUserEntity, organization_id: string): Promise<IUserEntityFront> => {
    const result = await this.repository.getById(props.user_id!, organization_id);
    return parseUser(result);
  };

  getAll = async (
    organization_id: string,
    user_type: USER_TYPE,
    cashier_number?: number,
    filter_user_type?: USER_TYPE
  ): Promise<IUserEntityFront[]> => {
    // OWNER can see all users from all organizations (for password reset)
    // Others only see users from their own organization
    const result = await this.repository.getAll(
      organization_id,
      user_type,
      cashier_number,
      filter_user_type
    );
    return result.map((user) => parseUser(user));
  };

  update = async (
    user_id: string,
    props: IUpdateUserEntity,
    organization_id: string
  ): Promise<IUserEntityFront> => {
    const result = await this.repository.update(user_id, props, organization_id);

    return parseUser(result);
  };

  delete = async (props: IDeleteUserEntity, organization_id: string) => {
    const response = await this.repository.delete(props.user_id, organization_id);
    return parseUser(response);
  };

  /**
   * Validate that a user exists and is CAPITALIST of the specified organization
   * Used by OWNER when resetting CAPITALIST passwords from organizations page
   */
  validateCapitalist = async (
    username: string,
    organization_id: string,
    adminUserType: USER_TYPE
  ): Promise<{ user_id: string; username: string }> => {
    // Only OWNER can use this endpoint
    if (adminUserType !== USER_TYPE.OWNER) {
      throw new ForbiddenError('Solo el OWNER puede validar CAPITALIST de otras organizaciones');
    }

    const user = await this.repository.getByUsernameAndOrganization(username, organization_id);

    if (user.user_type !== USER_TYPE.CAPITALIST) {
      throw new BadRequestError('El usuario no es CAPITALIST de esta organización');
    }

    return {
      user_id: user.user_id,
      username: user.username!,
    };
  };

  // ============= PASSWORD MANAGEMENT (Phase 3) =============

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
  resetPassword = async (
    targetUserId: string,
    adminUserId: string,
    adminUserType: USER_TYPE,
    adminOrgId: string,
    newPassword?: string
  ): Promise<{ password: string }> => {
    // Check base permissions - only OWNER, CAPITALIST, SUPERADMIN, ADMIN can reset passwords
    if (
      ![USER_TYPE.OWNER, USER_TYPE.CAPITALIST, USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN].includes(
        adminUserType
      )
    ) {
      throw new ForbiddenError('No tienes permisos para resetear contraseñas');
    }

    // Get target user to check their type and organization
    // For OWNER, fetch without org restriction to allow resetting CAPITALIST from other orgs
    let targetUser;
    if (adminUserType === USER_TYPE.OWNER) {
      targetUser = await this.repository.getByIdWithoutOrgRestriction(targetUserId);
    } else if (adminUserType === USER_TYPE.CAPITALIST) {
      // CAPITALIST can reset users from their org + sub-orgs
      const descendantOrgs = await this.repository.getOrganizationDescendants(adminOrgId);
      targetUser = await this.repository.getByIdWithoutOrgRestriction(targetUserId);
      if (!descendantOrgs.includes(targetUser.organization_id)) {
        throw new ForbiddenError(
          'Solo puedes resetear contraseñas de usuarios de tu organización o sub-organizaciones'
        );
      }
    } else {
      targetUser = await this.repository.getById(targetUserId, adminOrgId);
    }

    // Validate hierarchy - cannot reset password of same level or higher
    if (!this.canManageUser(adminUserType, targetUser.user_type)) {
      throw new ForbiddenError(
        'No puedes resetear la contraseña de un usuario de igual o mayor jerarquía'
      );
    }

    // Additional organization-based restrictions
    switch (adminUserType) {
      case USER_TYPE.OWNER:
        // OWNER can reset:
        // - CAPITALIST from any organization
        // - SUPERADMIN/ADMIN/CASHIER from their own organization only
        if (targetUser.user_type === USER_TYPE.CAPITALIST) {
          // OWNER can reset CAPITALIST from any organization - allow it
          break;
        }
        if (
          [USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN, USER_TYPE.CASHIER].includes(targetUser.user_type)
        ) {
          // Must be from same organization
          if (targetUser.organization_id !== adminOrgId) {
            throw new ForbiddenError(
              'Solo puedes resetear contraseñas de usuarios de tu organización'
            );
          }
        }
        break;

      case USER_TYPE.CAPITALIST:
        // CAPITALIST can reset SUPERADMIN/ADMIN/CASHIER from their org + sub-orgs
        // Already validated above with getOrganizationDescendants
        break;

      case USER_TYPE.SUPERADMIN:
        // SUPERADMIN can reset ADMIN/CASHIER from their own organization only
        if (targetUser.organization_id !== adminOrgId) {
          throw new ForbiddenError(
            'Solo puedes resetear contraseñas de usuarios de tu organización'
          );
        }
        break;

      case USER_TYPE.ADMIN:
        // ADMIN can reset CASHIER from their own organization only
        if (targetUser.organization_id !== adminOrgId) {
          throw new ForbiddenError(
            'Solo puedes resetear contraseñas de cajeros de tu organización'
          );
        }
        break;

      default:
        throw new ForbiddenError('No tienes permisos para resetear contraseñas');
    }

    // Generate password if not provided
    const password = newPassword || generateRandomPassword(12);

    // Validate password strength
    const validation = validatePasswordStrength(password);
    if (!validation.valid) {
      throw new BadRequestError(`Contraseña débil: ${validation.errors.join(', ')}`);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Update user password
    const authRepository = new AuthRepository();
    await authRepository.updatePassword(targetUserId, passwordHash, false); // false = no password change required

    // Revoke all user sessions (security measure)
    const sessionRepository = new SessionRepository();
    await sessionRepository.revokeAllUserSessions(targetUserId, 'password_reset_by_admin');

    // Audit log
    const auditRepository = new AuditRepository();
    await auditRepository.log({
      user_id: targetUserId,
      organization_id: targetUser.organization_id,
      event_type: 'password_reset_by_admin',
      success: true,
      metadata: {
        admin_user_id: adminUserId,
        admin_user_type: adminUserType,
        target_user_type: targetUser.user_type,
      },
    });

    return { password };
  };

  /**
   * User self-service password change
   * @param userId - User ID changing password
   * @param currentPassword - Current password (for verification)
   * @param newPassword - New password
   * @param organization_id - Organization ID
   */
  changePassword = async (
    userId: string,
    currentPassword: string,
    newPassword: string,
    organization_id: string
  ): Promise<void> => {
    // Get user
    const user = await this.repository.getById(userId, organization_id);

    // Verify current password
    if (!user.password_hash) {
      throw new BadRequestError('Contraseña no establecida');
    }

    const isValid = await comparePassword(currentPassword, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Contraseña actual incorrecta');
    }

    // Validate new password strength
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new BadRequestError(`Contraseña débil: ${validation.errors.join(', ')}`);
    }

    // Check if new password is different from current
    const isSamePassword = await comparePassword(newPassword, user.password_hash);
    if (isSamePassword) {
      throw new BadRequestError('La nueva contraseña debe ser diferente a la actual');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    const authRepository = new AuthRepository();
    await authRepository.updatePassword(userId, passwordHash, false); // false = no reset required

    // Revoke all user sessions (security measure - user will need to login again)
    const sessionRepository = new SessionRepository();
    await sessionRepository.revokeAllUserSessions(userId, 'password_changed');

    // Audit log
    const auditRepository = new AuditRepository();
    await auditRepository.log({
      user_id: userId,
      organization_id,
      event_type: 'password_changed',
      success: true,
    });
  };
}
