import { IUserEntityBack, IUserEntityFront } from '@helper/types/user.type';
import { AuthRepository } from '../repository/auth.repository';
import { IAuthLogin, IAuthLogout } from '@helper/types/auth.type';
import { parseUser } from 'api/src/user/helper/parseUser';
import { supabase } from 'api/database/db.connection';
import { generateEmail } from 'api/helper/generateEmail';
import { UnauthorizedError } from '@helper/errors';
import { hashPassword, comparePassword } from 'api/helper/password';
import { SessionRepository } from 'api/src/session/repository/session.repository';
import { AuditRepository } from 'api/src/session/repository/audit.repository';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from 'api/helper/JWT';
import { SESSION_CONFIG } from 'api/src/config/session.config';

export interface ILoginResponse {
  user: IUserEntityFront;
  organization_id: string;
  session_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

export interface IRefreshResponse {
  access_token: string;
  refresh_token: string;
}

export class AuthController {
  private repository = new AuthRepository();
  private sessionRepository = new SessionRepository();
  private auditRepository = new AuditRepository();

  /**
   * Login with username and password (NEW - Phase 2)
   * Uses bcrypt for password validation and creates session in database
   */
  loginWithSession = async (
    props: IAuthLogin,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ILoginResponse> => {
    const { username, password } = props;

    // 1. Fetch user from database
    let userData: IUserEntityBack;
    try {
      userData = await this.repository.getUserByUsername(username);
    } catch {
      // Log failed attempt
      await this.auditRepository.log({
        username,
        event_type: 'login_failed',
        success: false,
        error_message: 'User not found',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    // 2. Check if account is locked
    if (userData.locked_until && new Date(userData.locked_until) > new Date()) {
      await this.auditRepository.log({
        user_id: userData.user_id,
        username,
        event_type: 'login_failed',
        success: false,
        error_message: 'Account locked',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      throw new UnauthorizedError(
        `Cuenta bloqueada. Intenta nuevamente después de ${new Date(userData.locked_until).toLocaleTimeString()}`
      );
    }

    // 3. Check if password hash exists
    if (!userData.password_hash) {
      await this.auditRepository.log({
        user_id: userData.user_id,
        username,
        event_type: 'login_failed',
        success: false,
        error_message: 'No password set',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      throw new UnauthorizedError('Contraseña no establecida. Contacta a un administrador.');
    }

    // 4. Verify password
    const isValidPassword = await comparePassword(password, userData.password_hash);
    if (!isValidPassword) {
      // Increment failed attempts
      await this.repository.incrementFailedAttempts(userData.user_id);

      const newFailedAttempts = userData.failed_login_attempts + 1;

      // Lock account if max attempts reached
      if (newFailedAttempts >= SESSION_CONFIG.MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + SESSION_CONFIG.LOCKOUT_DURATION);
        await this.repository.lockAccount(userData.user_id, lockUntil);

        await this.auditRepository.log({
          user_id: userData.user_id,
          username,
          event_type: 'account_locked',
          success: false,
          error_message: `Max failed attempts reached (${newFailedAttempts})`,
          ip_address: ipAddress,
          user_agent: userAgent,
        });

        throw new UnauthorizedError(
          `Cuenta bloqueada por múltiples intentos fallidos. Intenta nuevamente después de ${lockUntil.toLocaleTimeString()}`
        );
      }

      await this.auditRepository.log({
        user_id: userData.user_id,
        username,
        event_type: 'login_failed',
        success: false,
        error_message: `Invalid password (attempt ${newFailedAttempts}/${SESSION_CONFIG.MAX_FAILED_ATTEMPTS})`,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    // 5. Check concurrent sessions limit
    if (SESSION_CONFIG.MAX_CONCURRENT_SESSIONS > 0) {
      const activeSessions = await this.sessionRepository.countActiveSessions(userData.user_id);
      if (activeSessions >= SESSION_CONFIG.MAX_CONCURRENT_SESSIONS) {
        await this.sessionRepository.revokeOldestSession(userData.user_id);
      }
    }

    // 6. Create session with temporary refresh token
    const tempRefreshToken = signRefreshToken(userData.user_id, 'temp', 1);
    const refreshTokenHash = await hashPassword(tempRefreshToken);

    const session = await this.sessionRepository.create({
      user_id: userData.user_id,
      organization_id: userData.organization_id,
      refresh_token_hash: refreshTokenHash,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // 7. Generate final tokens with actual session_id
    const accessToken = signAccessToken(
      userData.user_id,
      userData.username!,
      userData.user_type,
      session.session_id,
      userData.organization_id
    );

    const refreshToken = signRefreshToken(
      userData.user_id,
      session.session_id,
      session.refresh_token_version
    );

    // Update session with correct refresh token hash
    const finalRefreshTokenHash = await hashPassword(refreshToken);
    await this.sessionRepository.rotateRefreshToken(session.session_id, finalRefreshTokenHash);

    // 8. Update user login metadata
    await this.repository.updateLoginMetadata(userData.user_id, ipAddress || null);

    // 9. Reset failed attempts
    await this.repository.resetFailedAttempts(userData.user_id);

    // 10. Log successful login
    await this.auditRepository.log({
      user_id: userData.user_id,
      session_id: session.session_id,
      organization_id: userData.organization_id,
      username,
      event_type: 'login_success',
      success: true,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return {
      user: parseUser(userData),
      organization_id: userData.organization_id,
      session_id: session.session_id,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: session.expires_at,
    };
  };

  /**
   * Refresh access token using refresh token (NEW - Phase 2)
   */
  refreshToken = async (
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IRefreshResponse> => {
    // 1. Verify refresh token JWT
    let decoded: ReturnType<typeof verifyRefreshToken>;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      await this.auditRepository.log({
        event_type: 'refresh_token_invalid',
        success: false,
        error_message: 'Invalid JWT',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      throw new UnauthorizedError('Token de actualización inválido');
    }

    // 2. Get session from database
    const session = await this.sessionRepository.getById(decoded.session_id);
    if (!session || !session.is_active) {
      await this.auditRepository.log({
        session_id: decoded.session_id,
        event_type: 'refresh_token_invalid',
        success: false,
        error_message: 'Session not found or inactive',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      throw new UnauthorizedError('Sesión inválida o expirada');
    }

    // 3. Check if session expired
    if (new Date() > session.expires_at) {
      await this.sessionRepository.revoke(session.session_id, 'expired');
      await this.auditRepository.log({
        user_id: session.user_id,
        session_id: session.session_id,
        event_type: 'session_expired',
        success: false,
        error_message: 'Session expired',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      throw new UnauthorizedError('Sesión expirada');
    }

    // 4. Verify refresh token hash (detect token reuse)
    const isValidToken = await comparePassword(refreshToken, session.refresh_token_hash);

    if (!isValidToken) {
      // CRITICAL: Token reuse detected - revoke ALL user sessions
      await this.sessionRepository.revokeAllUserSessions(session.user_id, 'token_reuse_detected');

      await this.auditRepository.log({
        user_id: session.user_id,
        session_id: session.session_id,
        organization_id: session.organization_id,
        event_type: 'token_reuse_detected',
        success: false,
        error_message: 'Refresh token reuse detected - all sessions revoked',
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      throw new UnauthorizedError(
        'Actividad sospechosa detectada. Todas las sesiones han sido cerradas.'
      );
    }

    // 5. Get user data
    const userData = await this.repository.getUserById(session.user_id);

    // 6. Generate new tokens (rotate refresh token)
    const newAccessToken = signAccessToken(
      userData.user_id,
      userData.username!,
      userData.user_type,
      session.session_id,
      session.organization_id
    );

    const newRefreshToken = signRefreshToken(
      userData.user_id,
      session.session_id,
      session.refresh_token_version + 1
    );

    // 7. Update session with new refresh token hash
    const newRefreshTokenHash = await hashPassword(newRefreshToken);
    await this.sessionRepository.rotateRefreshToken(session.session_id, newRefreshTokenHash);

    // 8. Update activity (sliding window)
    await this.sessionRepository.updateActivity(session.session_id);

    // 9. Log successful refresh
    await this.auditRepository.log({
      user_id: session.user_id,
      session_id: session.session_id,
      organization_id: session.organization_id,
      event_type: 'refresh_token_used',
      success: true,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  };

  /**
   * Logout (revoke session) (NEW - Phase 2)
   */
  logoutSession = async (
    sessionId: string,
    userId: string,
    logoutAll: boolean = false
  ): Promise<boolean> => {
    if (logoutAll) {
      await this.sessionRepository.revokeAllUserSessions(userId, 'user_logout_all');
      await this.auditRepository.log({
        user_id: userId,
        event_type: 'logout_all',
        success: true,
      });
    } else {
      await this.sessionRepository.revoke(sessionId, 'user_logout');
      await this.auditRepository.log({
        user_id: userId,
        session_id: sessionId,
        event_type: 'logout',
        success: true,
      });
    }

    return true;
  };

  // ============= LEGACY METHODS (keep for backwards compatibility - Phase 4 will remove Supabase calls) =============

  /**
   * @deprecated Use loginWithSession instead. This will be updated in Phase 4.
   */
  login = async (
    props: IAuthLogin
  ): Promise<{ user: IUserEntityFront; organization_id: string }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: generateEmail(props.username),
      password: props.password,
    });

    if (error) {
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    const userData: IUserEntityBack = await this.repository.login({ ...props });

    return {
      user: parseUser(userData),
      organization_id: userData.organization_id,
    };
  };

  /**
   * @deprecated Use logoutSession instead. This will be updated in Phase 4.
   */
  logout = async (props: IAuthLogout) => {
    const { error } = await supabase.auth.admin.signOut(props.token);

    if (error) {
      throw new UnauthorizedError('Error al cerrar sesión');
    }

    return true;
  };

  /**
   * @deprecated Not implemented in old system. Use refreshToken instead.
   */
  refresh = async () => {
    return;
  };
}
