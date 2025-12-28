import { IUserEntityFront } from '@helper/types/user.type';
import { JwtPayload } from '@supabase/supabase-js';
import { JWT_SECRET_USER, JWT_SECRET_ACCESS, JWT_SECRET_REFRESH } from 'api/envs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { SESSION_CONFIG } from 'api/src/config/session.config';

// ============= ACCESS TOKEN (NEW) =============

export interface IAccessTokenPayload {
  user_id: string;
  username: string;
  user_type: string;
  session_id: string;
  organization_id: string;
  type: 'access';
  iat: number;
  exp: number;
}

/**
 * Sign a new access token (15 minutes expiration)
 */
export const signAccessToken = (
  userId: string,
  username: string,
  userType: string,
  sessionId: string,
  organizationId: string
): string => {
  const payload: Omit<IAccessTokenPayload, 'iat' | 'exp'> = {
    user_id: userId,
    username,
    user_type: userType,
    session_id: sessionId,
    organization_id: organizationId,
    type: 'access',
  };

  return jwt.sign(payload, JWT_SECRET_ACCESS, {
    expiresIn: SESSION_CONFIG.JWT_ACCESS_EXPIRATION,
  });
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): IAccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_ACCESS) as IAccessTokenPayload;
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch {
    throw new Error('Invalid access token');
  }
};

// ============= REFRESH TOKEN (NEW) =============

export interface IRefreshTokenPayload {
  user_id: string;
  session_id: string;
  token_version: number;
  type: 'refresh';
  iat: number;
  exp: number;
}

/**
 * Sign a new refresh token (30 days expiration)
 */
export const signRefreshToken = (
  userId: string,
  sessionId: string,
  tokenVersion: number
): string => {
  const payload: Omit<IRefreshTokenPayload, 'iat' | 'exp'> = {
    user_id: userId,
    session_id: sessionId,
    token_version: tokenVersion,
    type: 'refresh',
  };

  return jwt.sign(payload, JWT_SECRET_REFRESH, {
    expiresIn: SESSION_CONFIG.JWT_REFRESH_EXPIRATION,
  });
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): IRefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_REFRESH) as IRefreshTokenPayload;
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch {
    throw new Error('Invalid refresh token');
  }
};

// ============= LEGACY (keep for backwards compatibility during migration) =============

/**
 * @deprecated Use signAccessToken instead. This will be removed in Phase 5.
 */
export const signUserToken = (
  payload: IUserEntityFront,
  organization_id: string,
  options?: SignOptions
): string => {
  return jwt.sign({ ...payload, organization_id }, JWT_SECRET_USER, options);
};

/**
 * @deprecated Use verifyAccessToken instead. This will be removed in Phase 5.
 */
export const verifyUserToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET_USER) as JwtPayload;
};
