import jwt from 'jsonwebtoken';
import { StringValue } from 'ms';
import {
  POLLA_JWT_SECRET_ACCESS,
  POLLA_JWT_SECRET_REFRESH,
  POLLA_SESSION_CONFIG,
} from '../config/polla-session.config';

export interface IPollaAccessTokenPayload {
  polla_user_id: string;
  username: string;
  user_type: string;
  session_id: string;
  polla_organization_id: string;
  type: 'polla_access';
  iat: number;
  exp: number;
}

export interface IPollaRefreshTokenPayload {
  polla_user_id: string;
  session_id: string;
  token_version: number;
  type: 'polla_refresh';
  iat: number;
  exp: number;
}

export const signPollaAccessToken = (
  pollaUserId: string,
  username: string,
  userType: string,
  sessionId: string,
  organizationId: string
): string =>
  jwt.sign(
    {
      polla_user_id: pollaUserId,
      username,
      user_type: userType,
      session_id: sessionId,
      polla_organization_id: organizationId,
      type: 'polla_access',
    },
    POLLA_JWT_SECRET_ACCESS,
    { expiresIn: String(POLLA_SESSION_CONFIG.JWT_ACCESS_EXPIRATION) as StringValue }
  );

export const verifyPollaAccessToken = (token: string): IPollaAccessTokenPayload => {
  const decoded = jwt.verify(token, POLLA_JWT_SECRET_ACCESS) as IPollaAccessTokenPayload;
  if (decoded.type !== 'polla_access') {
    throw new Error('Invalid token type');
  }
  return decoded;
};

export const signPollaRefreshToken = (
  pollaUserId: string,
  sessionId: string,
  tokenVersion: number
): string =>
  jwt.sign(
    {
      polla_user_id: pollaUserId,
      session_id: sessionId,
      token_version: tokenVersion,
      type: 'polla_refresh',
    },
    POLLA_JWT_SECRET_REFRESH,
    { expiresIn: String(POLLA_SESSION_CONFIG.JWT_REFRESH_EXPIRATION) as StringValue }
  );

export const verifyPollaRefreshToken = (token: string): IPollaRefreshTokenPayload => {
  const decoded = jwt.verify(token, POLLA_JWT_SECRET_REFRESH) as IPollaRefreshTokenPayload;
  if (decoded.type !== 'polla_refresh') {
    throw new Error('Invalid token type');
  }
  return decoded;
};
