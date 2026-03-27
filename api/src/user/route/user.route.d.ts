import { Router } from 'express';
export declare class UserRouter {
  router: Router;
  private controller;
  constructor();
  private setupRoutes;
  private newUserhandler;
  private getUserHandler;
  private getAllUserHandler;
  private updateUserHandler;
  private deleteUserHandler;
  /**
   * POST /api/private/user/reset-password/:id
   * Admin endpoint to reset user password
   * Hierarchy: OWNER -> CAPITALIST -> SUPERADMIN -> ADMIN -> CASHIER
   * Each level can only reset passwords of lower levels
   */
  private resetPasswordHandler;
  /**
   * POST /api/private/user/change-password
   * User self-service password change
   * Any authenticated user can change their own password
   */
  private changePasswordHandler;
  /**
   * POST /api/private/user/unlock/:id
   * Admin endpoint to unlock a user account
   * Resets locked_until and failed_login_attempts
   * Only non-cashier users can unlock accounts
   */
  private unlockAccountHandler;
  /**
   * GET /api/private/user/validate-capitalist?username=XXX&organization_id=YYY
   * Validate that a user exists and is CAPITALIST of the specified organization
   * Only accessible by OWNER
   */
  private validateCapitalistHandler;
  /**
   * GET /api/private/user/assignable?exclude_group_id=XXX
   * Get users that can be assigned to groups
   * Only OWNER and CAPITALIST can access
   */
  private getAssignableUsersHandler;
  /**
   * POST /api/private/user/assign-to-group
   * Assign a user to a group (change their organization_id)
   * Only OWNER and CAPITALIST can access
   * Body: { user_id: string, group_id: string }
   */
  private assignUserToGroupHandler;
}
