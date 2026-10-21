import { UnauthorizedError, ForbiddenError, BadRequestError } from '@helper/errors';
import { IPollaSessionUser, POLLA_THEME } from '@helper/polla/types/user.type';
import { comparePassword, hashPassword } from 'api/helper/password';
import { PollaAuthRepository } from '../repository/polla-auth.repository';
import {
  signPollaAccessToken,
  signPollaRefreshToken,
  verifyPollaRefreshToken,
} from '../../helper/polla-jwt';

export interface IPollaLoginResult {
  accessToken: string;
  refreshToken: string;
  user: IPollaSessionUser;
}

const toSessionUser = (user: {
  polla_user_id: string;
  name: string;
  last_name: string | null;
  username: string | null;
  number: number | null;
  user_type: IPollaSessionUser['user_type'];
  polla_organization_id: string;
  polla_group_id: string | null;
  parent_polla_user_id: string | null;
  password_reset_required: boolean;
  theme: POLLA_THEME;
}): IPollaSessionUser => ({
  polla_user_id: user.polla_user_id,
  name: user.name,
  last_name: user.last_name,
  username: user.username,
  number: user.number,
  user_type: user.user_type,
  polla_organization_id: user.polla_organization_id,
  polla_group_id: user.polla_group_id,
  parent_polla_user_id: user.parent_polla_user_id,
  password_reset_required: user.password_reset_required,
  theme: user.theme,
});

export class PollaAuthController {
  private repository = new PollaAuthRepository();

  async login(
    username: string,
    password: string,
    ip?: string,
    userAgent?: string
  ): Promise<IPollaLoginResult> {
    const user = await this.repository.getUserByUsername(username);

    // Mensaje único para usuario inexistente y contraseña mala: no filtramos
    // qué usuarios existen.
    if (!user || !user.password_hash) {
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    if (user.disabled) {
      throw new ForbiddenError('El usuario está deshabilitado');
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new ForbiddenError('La cuenta está bloqueada temporalmente por intentos fallidos');
    }

    const isValid = await comparePassword(password, user.password_hash);

    if (!isValid) {
      await this.repository.registerFailedLogin(
        user.polla_user_id,
        (user.failed_login_attempts ?? 0) + 1
      );
      throw new UnauthorizedError('Usuario o contraseña incorrectos');
    }

    const session = await this.repository.createSession(
      user.polla_user_id,
      user.polla_organization_id,
      ip,
      userAgent
    );

    await this.repository.registerSuccessfulLogin(user.polla_user_id, ip);

    return {
      accessToken: signPollaAccessToken(
        user.polla_user_id,
        user.username ?? '',
        user.user_type,
        session.polla_session_id,
        user.polla_organization_id
      ),
      refreshToken: signPollaRefreshToken(
        user.polla_user_id,
        session.polla_session_id,
        session.token_version
      ),
      user: toSessionUser(user),
    };
  }

  async refresh(refreshToken: string): Promise<IPollaLoginResult> {
    let decoded: ReturnType<typeof verifyPollaRefreshToken>;
    try {
      decoded = verifyPollaRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Refresh token inválido');
    }

    const session = await this.repository.getSessionById(decoded.session_id);

    if (!session || !session.is_active) {
      throw new UnauthorizedError('Sesión inválida');
    }

    // Reuso de un refresh token viejo: se mata la sesión entera.
    if (session.token_version !== decoded.token_version) {
      await this.repository.revokeSession(session.polla_session_id);
      throw new UnauthorizedError('Refresh token reutilizado, sesión revocada');
    }

    if (new Date(session.expires_at) < new Date()) {
      await this.repository.revokeSession(session.polla_session_id);
      throw new UnauthorizedError('Sesión expirada');
    }

    const user = await this.repository.getSessionUserById(session.polla_user_id);
    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    const nextVersion = session.token_version + 1;
    await this.repository.bumpTokenVersion(session.polla_session_id, nextVersion);
    await this.repository.touchSession(session.polla_session_id);

    return {
      accessToken: signPollaAccessToken(
        user.polla_user_id,
        user.username ?? '',
        user.user_type,
        session.polla_session_id,
        session.polla_organization_id
      ),
      refreshToken: signPollaRefreshToken(
        user.polla_user_id,
        session.polla_session_id,
        nextVersion
      ),
      user: toSessionUser(user),
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.repository.revokeSession(sessionId);
  }

  async logoutAll(pollaUserId: string): Promise<void> {
    await this.repository.revokeAllSessions(pollaUserId);
  }

  async changePassword(
    pollaUserId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.repository.getUserById(pollaUserId);

    if (!user || !user.password_hash) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    const isValid = await comparePassword(currentPassword, user.password_hash);
    if (!isValid) {
      throw new BadRequestError('La contraseña actual es incorrecta');
    }

    await this.repository.updatePassword(pollaUserId, await hashPassword(newPassword));
  }

  async updateTheme(pollaUserId: string, theme: POLLA_THEME): Promise<IPollaSessionUser> {
    await this.repository.updateTheme(pollaUserId, theme);

    const user = await this.repository.getSessionUserById(pollaUserId);
    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    return toSessionUser(user);
  }
}
