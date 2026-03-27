import { IUserEntityFront } from '@helper/types/user.type';
import { IAuthLogin } from '@helper/types/auth.type';
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
export declare class AuthController {
  private repository;
  private sessionRepository;
  private auditRepository;
  /**
   * Login with username and password (NEW - Phase 2)
   * Uses bcrypt for password validation and creates session in database
   */
  loginWithSession: (
    props: IAuthLogin,
    ipAddress?: string,
    userAgent?: string
  ) => Promise<ILoginResponse>;
  /**
   * Refresh access token using refresh token (NEW - Phase 2)
   */
  refreshToken: (
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ) => Promise<IRefreshResponse>;
  /**
   * Logout (revoke session) (NEW - Phase 2)
   */
  logoutSession: (sessionId: string, userId: string, logoutAll?: boolean) => Promise<boolean>;
}
