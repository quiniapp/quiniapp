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
export declare const signAccessToken: (
  userId: string,
  username: string,
  userType: string,
  sessionId: string,
  organizationId: string
) => string;
/**
 * Verify access token
 */
export declare const verifyAccessToken: (token: string) => IAccessTokenPayload;
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
export declare const signRefreshToken: (
  userId: string,
  sessionId: string,
  tokenVersion: number
) => string;
/**
 * Verify refresh token
 */
export declare const verifyRefreshToken: (token: string) => IRefreshTokenPayload;
