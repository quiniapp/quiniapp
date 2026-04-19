import { IAuthLogin } from '@helper/types/auth.type';
import { UnauthorizedError, InternalServerError } from '@helper/errors';
import { supabase } from '@database/db.connection';
import { IUserEntityBack } from '@helper/types/user.type';

export class AuthRepository {
  /**
   * Get user by username (for login)
   * @deprecated Use getUserByUsername instead
   */
  async login(props: IAuthLogin) {
    return this.getUserByUsername(props.username);
  }

  /**
   * Get user by username (for login)
   */
  async getUserByUsername(username: string): Promise<IUserEntityBack> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .is('deleted_at', null)
      .eq('disabled', false)
      .single();

    // Si hay error de Supabase o no hay datos, significa que el usuario no existe
    // Por seguridad, usar el mismo mensaje que cuando la contraseña es incorrecta
    if (error || !data) {
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    return data as IUserEntityBack;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUserEntityBack> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    return data as IUserEntityBack;
  }

  /**
   * Increment failed login attempts
   */
  async incrementFailedAttempts(userId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_failed_attempts', {
      p_user_id: userId,
    });
    if (error) {
      console.error('[AuthRepository] increment_failed_attempts RPC failed:', error);
    }
  }

  /**
   * Reset failed login attempts
   */
  async resetFailedAttempts(userId: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[AuthRepository] Failed to reset failed attempts:', error);
    }
  }

  /**
   * Lock user account
   */
  async lockAccount(userId: string, lockUntil: Date): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        locked_until: lockUntil.toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[AuthRepository] Failed to lock account:', error);
      throw new InternalServerError('Failed to lock account');
    }
  }

  /**
   * Unlock account and reset failed attempts
   * Used by administrators to manually unlock blocked accounts
   */
  async unlockAccount(userId: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        locked_until: null,
        failed_login_attempts: 0,
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[AuthRepository] Failed to unlock account:', error);
      throw new InternalServerError(`Error unlocking account: ${error.message}`);
    }
  }

  /**
   * Update user login metadata
   */
  async updateLoginMetadata(userId: string, ipAddress: string | null): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        last_login_ip: ipAddress,
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[AuthRepository] Failed to update login metadata:', error);
    }
  }

  /**
   * Update user password
   */
  async updatePassword(
    userId: string,
    passwordHash: string,
    resetRequired: boolean = false
  ): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString(),
        password_reset_required: resetRequired,
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[AuthRepository] Failed to update password:', error);
      throw new InternalServerError('Failed to update password');
    }
  }
}
