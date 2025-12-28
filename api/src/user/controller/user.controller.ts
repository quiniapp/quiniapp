import { UserRepository } from '../repository/user.repository';
import {
  IDeleteUserEntity,
  IGetUserEntity,
  INewUserEntity,
  IUpdateUserEntity,
} from '@helper/request/user.request';
import { CASHIER_TYPE, IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { parseUser } from '../helper/parseUser';
import { buildUserForDB } from '../helper/userBase';
import { supabase } from 'api/database/db.connection';
import {
  InternalServerError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
} from '@helper/errors';
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

export class UserController {
  private repository = new UserRepository();

  create = async (newUser: INewUserEntity, organization_id: string): Promise<IUserEntityFront> => {
    const user = await buildUserForDB(newUser, organization_id);
    const result = await this.repository.create(user);

    if (user.cashier_type !== CASHIER_TYPE.STREET) {
      const { error } = await supabase.auth.signUp({
        email: user.email!,
        password: newUser.password,
      });

      if (error) {
        await this.repository.deleteFailedUser(result.user_id);
        throw new InternalServerError(error.message);
      }
    }

    return parseUser(result);
  };
  get = async (props: IGetUserEntity, organization_id: string): Promise<IUserEntityFront> => {
    const result = await this.repository.getById(props.user_id!, organization_id);
    return parseUser(result);
  };

  getAll = async (
    organization_id: string,
    cashier_number?: number
  ): Promise<IUserEntityFront[]> => {
    const result = await this.repository.getAll(organization_id, cashier_number);
    return result.map((user) => parseUser(user));
  };

  update = async (
    user_id: string,
    props: IUpdateUserEntity,
    organization_id: string
  ): Promise<IUserEntityFront> => {
    const result = await this.repository.update(user_id, props, organization_id);

    // TO DO: validar el password despues
    // if (user.cashier_type !== CASHIER_TYPE.STREET) {
    //   const { error } = await supabase.auth.signUp({
    //     email: user.email!,
    //     password: newUser.password,
    //   });

    //   if (error) {
    //     await this.repository.delete(result.user_id);
    //     throw new InternalServerError(error.message);
    //   }
    // }

    return parseUser(result);
  };

  delete = async (props: IDeleteUserEntity, organization_id: string) => {
    const response = await this.repository.delete(props.user_id, organization_id);
    return parseUser(response);
  };

  // ============= PASSWORD MANAGEMENT (Phase 3) =============

  /**
   * Admin password reset (OWNER, SUPERADMIN, ADMIN can reset passwords)
   * @param targetUserId - User ID whose password will be reset
   * @param adminUserId - Admin user ID performing the reset
   * @param adminUserType - Admin user type (for permission check)
   * @param organization_id - Organization ID
   * @param newPassword - Optional new password (if not provided, generates random)
   * @returns Object with the new password
   */
  resetPassword = async (
    targetUserId: string,
    adminUserId: string,
    adminUserType: USER_TYPE,
    organization_id: string,
    newPassword?: string
  ): Promise<{ password: string }> => {
    // Check permissions
    if (![USER_TYPE.OWNER, USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN].includes(adminUserType)) {
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
    await authRepository.updatePassword(targetUserId, passwordHash, true); // true = require password change on next login

    // Revoke all user sessions (security measure)
    const sessionRepository = new SessionRepository();
    await sessionRepository.revokeAllUserSessions(targetUserId, 'password_reset_by_admin');

    // Audit log
    const auditRepository = new AuditRepository();
    await auditRepository.log({
      user_id: targetUserId,
      organization_id,
      event_type: 'password_reset_by_admin',
      success: true,
      metadata: {
        admin_user_id: adminUserId,
        admin_user_type: adminUserType,
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
