import { UnauthorizedError, InternalServerError } from '@helper/errors';
import { supabase } from '@database/db.connection';
export class AuthRepository {
    /**
     * Get user by username (for login)
     * @deprecated Use getUserByUsername instead
     */
    async login(props) {
        return this.getUserByUsername(props.username);
    }
    /**
     * Get user by username (for login)
     */
    async getUserByUsername(username) {
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
        return data;
    }
    /**
     * Get user by ID
     */
    async getUserById(userId) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .single();
        if (error || !data) {
            throw new UnauthorizedError('Usuario no encontrado');
        }
        return data;
    }
    /**
     * Increment failed login attempts
     */
    async incrementFailedAttempts(userId) {
        // Try to use the RPC function first (created in migration)
        const { error: rpcError } = await supabase.rpc('increment_failed_attempts', {
            p_user_id: userId,
        });
        // Fallback if RPC doesn't exist or fails
        if (rpcError) {
            // Fetch current value, increment, and update
            const { data: user } = await supabase
                .from('users')
                .select('failed_login_attempts')
                .eq('user_id', userId)
                .single();
            if (user) {
                const { error } = await supabase
                    .from('users')
                    .update({
                    failed_login_attempts: (user.failed_login_attempts ?? 0) + 1,
                })
                    .eq('user_id', userId);
                if (error) {
                    console.error('[AuthRepository] Failed to increment failed attempts:', error);
                }
            }
        }
    }
    /**
     * Reset failed login attempts
     */
    async resetFailedAttempts(userId) {
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
    async lockAccount(userId, lockUntil) {
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
    async unlockAccount(userId) {
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
    async updateLoginMetadata(userId, ipAddress) {
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
    async updatePassword(userId, passwordHash, resetRequired = false) {
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
