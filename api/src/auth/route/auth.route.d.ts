import { Router } from 'express';
export declare class AuthRouter {
  publicRouter: Router;
  privateRouter: Router;
  private controller;
  constructor();
  private setupPublicRoutes;
  private setupPrivateRoutes;
  /**
   * POST /api/auth/login
   * Login with username and password using custom JWT session system
   */
  private loginHandler;
  /**
   * POST /api/auth/refresh (NEW - Phase 2)
   * Refresh access token using refresh token
   */
  private refreshTokenHandler;
  /**
   * POST /api/private/auth/logout
   * Maintains backward compatibility
   */
  private logoutHandler;
  /**
   * POST /api/private/auth/logout-all (NEW - Phase 2)
   * Logout from all devices (revoke all user sessions)
   */
  private logoutAllHandler;
  /**
   * GET /api/private/auth/validate
   * Validate current session
   */
  private validateHandler;
}
