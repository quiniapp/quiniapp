import { IAuthLogin } from '@helper/types/auth.type';
import { IUserEntityBack } from '@helper/types/user.type';
export declare class AuthRepository {
  /**
   * Get user by username (for login)
   * @deprecated Use getUserByUsername instead
   */
  login(props: IAuthLogin): Promise<IUserEntityBack>;
  /**
   * Get user by username (for login)
   */
  getUserByUsername(username: string): Promise<IUserEntityBack>;
  /**
   * Get user by ID
   */
  getUserById(userId: string): Promise<IUserEntityBack>;
  /**
   * Increment failed login attempts
   */
  incrementFailedAttempts(userId: string): Promise<void>;
  /**
   * Reset failed login attempts
   */
  resetFailedAttempts(userId: string): Promise<void>;
  /**
   * Lock user account
   */
  lockAccount(userId: string, lockUntil: Date): Promise<void>;
  /**
   * Unlock account and reset failed attempts
   * Used by administrators to manually unlock blocked accounts
   */
  unlockAccount(userId: string): Promise<void>;
  /**
   * Update user login metadata
   */
  updateLoginMetadata(userId: string, ipAddress: string | null): Promise<void>;
  /**
   * Update user password
   */
  updatePassword(userId: string, passwordHash: string, resetRequired?: boolean): Promise<void>;
}
