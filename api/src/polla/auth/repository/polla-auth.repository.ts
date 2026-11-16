import { supabase } from '@database/db.connection';
import {
  IPollaSessionUser,
  IPollaUserEntityBack,
  POLLA_THEME,
} from '@helper/polla/types/user.type';
import { throwIfPollaError } from '../../helper/polla-errors';
import { POLLA_SESSION_CONFIG } from '../../config/polla-session.config';

export interface IPollaSessionRow {
  polla_session_id: string;
  polla_user_id: string;
  polla_organization_id: string;
  token_version: number;
  is_active: boolean;
  expires_at: string;
  last_activity_at: string;
  created_at: string;
}

const SESSION_USER_COLUMNS =
  'polla_user_id, name, last_name, username, number, user_type, polla_organization_id, polla_group_id, parent_polla_user_id, password_reset_required, theme';

export class PollaAuthRepository {
  async getUserByUsername(username: string): Promise<IPollaUserEntityBack | null> {
    const { data, error } = await supabase
      .from('polla_users')
      .select('*')
      .eq('username', username)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(error);
    return data as IPollaUserEntityBack | null;
  }

  async getUserById(pollaUserId: string): Promise<IPollaUserEntityBack | null> {
    const { data, error } = await supabase
      .from('polla_users')
      .select('*')
      .eq('polla_user_id', pollaUserId)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(error);
    return data as IPollaUserEntityBack | null;
  }

  /**
   * Usuario de la sesión, o `null` si no puede operar: borrado, deshabilitado
   * o jugador de un pasador deshabilitado (queda frenado como si lo estuviera
   * él, sin marcarlo).
   */
  async getSessionUserById(pollaUserId: string): Promise<IPollaSessionUser | null> {
    const { data, error } = await supabase
      .from('polla_users')
      // Embebido por columna: el pasador del jugador (muchos a uno).
      .select(`${SESSION_USER_COLUMNS}, parent:parent_polla_user_id(disabled)`)
      .eq('polla_user_id', pollaUserId)
      .eq('disabled', false)
      .is('deleted_at', null)
      .maybeSingle();

    throwIfPollaError(error);
    if (!data) return null;

    const { parent, ...user } = data as unknown as IPollaSessionUser & {
      parent: { disabled: boolean } | null;
    };
    return parent?.disabled ? null : user;
  }

  /** Si el usuario (por ejemplo, el pasador de un jugador) está deshabilitado. */
  async isUserDisabled(pollaUserId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('polla_users')
      .select('disabled')
      .eq('polla_user_id', pollaUserId)
      .maybeSingle();

    throwIfPollaError(error);
    return Boolean(data?.disabled);
  }

  // ------------------------------------------------------------- sesiones

  async createSession(
    pollaUserId: string,
    organizationId: string,
    ip?: string,
    userAgent?: string
  ): Promise<IPollaSessionRow> {
    const expiresAt = new Date(Date.now() + POLLA_SESSION_CONFIG.INACTIVITY_TIMEOUT_MS);

    const { data, error } = await supabase
      .from('polla_sessions')
      .insert({
        polla_user_id: pollaUserId,
        polla_organization_id: organizationId,
        expires_at: expiresAt.toISOString(),
        ip: ip ?? null,
        user_agent: userAgent ?? null,
      })
      .select('*')
      .single();

    throwIfPollaError(error);
    return data as IPollaSessionRow;
  }

  async getSessionById(sessionId: string): Promise<IPollaSessionRow | null> {
    const { data, error } = await supabase
      .from('polla_sessions')
      .select('*')
      .eq('polla_session_id', sessionId)
      .maybeSingle();

    throwIfPollaError(error);
    return data as IPollaSessionRow | null;
  }

  async touchSession(sessionId: string): Promise<void> {
    const expiresAt = new Date(Date.now() + POLLA_SESSION_CONFIG.INACTIVITY_TIMEOUT_MS);

    const { error } = await supabase
      .from('polla_sessions')
      .update({
        last_activity_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('polla_session_id', sessionId);

    throwIfPollaError(error);
  }

  async revokeSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('polla_sessions')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('polla_session_id', sessionId);

    throwIfPollaError(error);
  }

  async revokeAllSessions(pollaUserId: string): Promise<void> {
    const { error } = await supabase
      .from('polla_sessions')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('polla_user_id', pollaUserId)
      .eq('is_active', true);

    throwIfPollaError(error);
  }

  /** Cierra las sesiones activas de los jugadores del pasador. */
  async revokePlayerSessions(cashierId: string): Promise<void> {
    const { error } = await supabase.rpc('polla_revoke_player_sessions', {
      p_cashier_id: cashierId,
    });

    throwIfPollaError(error);
  }

  async bumpTokenVersion(sessionId: string, tokenVersion: number): Promise<void> {
    const { error } = await supabase
      .from('polla_sessions')
      .update({ token_version: tokenVersion })
      .eq('polla_session_id', sessionId);

    throwIfPollaError(error);
  }

  // ----------------------------------------------------- login / password

  async registerFailedLogin(pollaUserId: string, attempts: number): Promise<void> {
    const shouldLock = attempts >= POLLA_SESSION_CONFIG.MAX_FAILED_LOGIN_ATTEMPTS;

    const { error } = await supabase
      .from('polla_users')
      .update({
        failed_login_attempts: attempts,
        locked_until: shouldLock
          ? new Date(Date.now() + POLLA_SESSION_CONFIG.ACCOUNT_LOCKOUT_MS).toISOString()
          : null,
      })
      .eq('polla_user_id', pollaUserId);

    throwIfPollaError(error);
  }

  async registerSuccessfulLogin(pollaUserId: string, ip?: string): Promise<void> {
    const { error } = await supabase
      .from('polla_users')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        last_login_ip: ip ?? null,
      })
      .eq('polla_user_id', pollaUserId);

    throwIfPollaError(error);
  }

  async updatePassword(pollaUserId: string, passwordHash: string): Promise<void> {
    const { error } = await supabase
      .from('polla_users')
      .update({
        password_hash: passwordHash,
        password_changed_at: new Date().toISOString(),
        password_reset_required: false,
        edited_at: new Date().toISOString(),
      })
      .eq('polla_user_id', pollaUserId);

    throwIfPollaError(error);
  }

  /**
   * Blanqueo hecho por un superior: la contraseña nueva es definitiva (nadie se
   * la cambia a sí mismo), se levanta el bloqueo y se cierran las sesiones.
   */
  async resetPassword(pollaUserId: string, passwordHash: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('polla_users')
      .update({
        password_hash: passwordHash,
        password_changed_at: now,
        password_reset_required: false,
        failed_login_attempts: 0,
        locked_until: null,
        edited_at: now,
      })
      .eq('polla_user_id', pollaUserId)
      .is('deleted_at', null);

    throwIfPollaError(error);
    await this.revokeAllSessions(pollaUserId);
  }

  async updateTheme(pollaUserId: string, theme: POLLA_THEME): Promise<void> {
    const { error } = await supabase
      .from('polla_users')
      .update({ theme, edited_at: new Date().toISOString() })
      .eq('polla_user_id', pollaUserId);

    throwIfPollaError(error);
  }
}
