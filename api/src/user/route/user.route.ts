import { Request, Response, Router } from 'express';
import { UserController } from '../controller/user.controller';
import { INewUserEntity } from '@helper/request/user.request';
import { APIResponse } from '@helper/response/api_response.response';
import { BadRequestError, ForbiddenError } from '@helper/errors';
import { IUserEntityFront, USER_TYPE } from '@helper/types/user.type';
import { asyncHandler } from '../../middlewares/error.middleware';

export class UserRouter {
  public router: Router;

  private controller: UserController;

  constructor() {
    this.router = Router();
    this.controller = new UserController();
    this.setupRoutes();
  }

  private setupRoutes() {
    // IMPORTANT: Specific routes must come BEFORE parameterized routes
    // Validate CAPITALIST for cross-org password reset
    this.router.get('/validate-capitalist', this.validateCapitalistHandler);

    // Password Management (Phase 3)
    this.router.post('/change-password', this.changePasswordHandler);
    this.router.post('/reset-password/:id', this.resetPasswordHandler);
    this.router.post('/unlock/:id', this.unlockAccountHandler);

    // Group assignment routes
    this.router.get('/assignable', this.getAssignableUsersHandler);
    this.router.post('/assign-to-group', this.assignUserToGroupHandler);
    this.router.post('/remove-from-group', this.removeUserFromGroupHandler);

    // Standard CRUD routes
    this.router.get('/:id', this.getUserHandler);
    this.router.get('/', this.getAllUserHandler);
    this.router.post('/', this.newUserhandler);
    this.router.put('/:id', this.updateUserHandler);
    this.router.delete('/:id', this.deleteUserHandler);
  }

  private newUserhandler = asyncHandler(async (req: Request, res: Response) => {
    const { newUser }: { newUser: INewUserEntity } = req.body;
    const { user } = req;

    if (!newUser) {
      throw new BadRequestError('Datos del nuevo usuario requeridos');
    }

    if (newUser?.user_type === USER_TYPE.OWNER) {
      throw new ForbiddenError('No se puede crear un usuario de tipo OWNER');
    }

    if ([USER_TYPE.ADMIN, USER_TYPE.CASHIER].includes(user!.user.user_type)) {
      throw new ForbiddenError('No tienes permisos para crear usuarios');
    }

    const createdUser = await this.controller.create(newUser, req.organization_id!);

    const response: APIResponse<IUserEntityFront> = {
      data: {
        user: createdUser!,
      },
    };

    res.status(200).json(response);
  });

  private getUserHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id: user_id } = req.params;
    const { user } = req;

    if (!user_id) {
      throw new BadRequestError('ID de usuario requerido');
    }

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      throw new ForbiddenError('Los cajeros no pueden ver otros usuarios');
    }

    let fetchedUser;
    if ([USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(user!.user.user_type)) {
      fetchedUser = await this.controller.getByIdFromNetwork(user_id, req.organization_id!);
    } else {
      fetchedUser = await this.controller.get({ user_id }, req.organization_id!);
    }

    const response: APIResponse<IUserEntityFront> = {
      data: {
        user: fetchedUser,
      },
    };
    res.status(200).json(response);
  });
  private getAllUserHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req;
    const { cashier_number, filter_user_type, group_id, include_session } = req.query;

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      throw new ForbiddenError('Los cajeros no pueden listar usuarios');
    }

    let parsedCashierNumber: number | undefined = undefined;
    if (typeof cashier_number === 'string') {
      parsedCashierNumber = parseInt(cashier_number, 10);
    }

    // Parse filter_user_type from query parameter
    let filterUserType: USER_TYPE | undefined = undefined;
    if (typeof filter_user_type === 'string' && filter_user_type in USER_TYPE) {
      filterUserType = filter_user_type as USER_TYPE;
    }

    // Parse include_session from query parameter
    const includeSession = include_session === 'true';

    // Determine which organization to query
    let targetOrgId = req.organization_id!;

    // CAPITALIST and OWNER can query users from a specific group in their network
    if (group_id && typeof group_id === 'string') {
      if ([USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(user!.user.user_type)) {
        // Verify group is in their network
        const networkOrgIds = await this.controller.getNetworkOrgIds(req.organization_id!);
        if (!networkOrgIds.includes(group_id)) {
          throw new ForbiddenError('El grupo no pertenece a tu red de organizaciones');
        }
        targetOrgId = group_id;
      }
    }

    const users = await this.controller.getAll(
      targetOrgId,
      user!.user.user_type,
      parsedCashierNumber,
      filterUserType,
      includeSession
    );
    const response: APIResponse<IUserEntityFront[]> = {
      data: {
        users,
      },
    };
    res.status(200).json(response);
  });
  private updateUserHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id: user_id } = req.params;
    const { updateUser } = req.body;
    const { user } = req;

    if (!user_id || !updateUser) {
      throw new BadRequestError('ID de usuario y datos de actualización requeridos');
    }

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      throw new ForbiddenError('Los cajeros no pueden actualizar usuarios');
    }

    // For CAPITALIST/OWNER, resolve the user's real org_id (may be in a sub-org)
    let targetOrgId = req.organization_id!;
    if ([USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(user!.user.user_type)) {
      const targetUser = await this.controller.getByIdFromNetwork(user_id, req.organization_id!);
      targetOrgId = targetUser.organization_id;
    }

    const updatedUser = await this.controller.update(user_id, updateUser, targetOrgId);

    const response: APIResponse<IUserEntityFront> = {
      data: {
        user: updatedUser,
      },
    };
    res.status(200).json(response);
  });
  private deleteUserHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id: user_id } = req.params;
    const { user } = req;

    if (!user_id) {
      throw new BadRequestError('ID de usuario requerido');
    }

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      throw new ForbiddenError('Los cajeros no pueden eliminar usuarios');
    }

    // For CAPITALIST/OWNER, resolve the user's real org_id (may be in a sub-org)
    let targetOrgId = req.organization_id!;
    if ([USER_TYPE.OWNER, USER_TYPE.CAPITALIST].includes(user!.user.user_type)) {
      const targetUser = await this.controller.getByIdFromNetwork(user_id, req.organization_id!);
      targetOrgId = targetUser.organization_id;
    }

    const deletedUser = await this.controller.delete({ user_id }, targetOrgId);

    const response: APIResponse<IUserEntityFront> = {
      data: {
        user: deletedUser,
      },
    };
    res.status(200).json(response);
  });

  // ============= PASSWORD MANAGEMENT (Phase 3) =============

  /**
   * POST /api/private/user/reset-password/:id
   * Admin endpoint to reset user password
   * Hierarchy: OWNER -> CAPITALIST -> SUPERADMIN -> ADMIN -> CASHIER
   * Each level can only reset passwords of lower levels
   */
  private resetPasswordHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id: targetUserId } = req.params;
    const { newPassword } = req.body; // Optional - if not provided, generates random password
    const { user } = req;

    if (!targetUserId) {
      throw new BadRequestError('ID de usuario requerido');
    }

    if (!user) {
      throw new ForbiddenError('No autenticado');
    }

    // Check permissions - only OWNER, CAPITALIST, SUPERADMIN, ADMIN can reset passwords
    if (
      ![USER_TYPE.OWNER, USER_TYPE.CAPITALIST, USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN].includes(
        user.user.user_type
      )
    ) {
      throw new ForbiddenError('No tienes permisos para resetear contraseñas');
    }

    const result = await this.controller.resetPassword(
      targetUserId,
      user.user.user_id!,
      user.user.user_type,
      req.organization_id!,
      newPassword
    );

    const response: APIResponse<string> = {
      data: {
        password: result.password,
      },
    };

    res.status(200).json(response);
  });

  /**
   * POST /api/private/user/change-password
   * User self-service password change
   * Any authenticated user can change their own password
   */
  private changePasswordHandler = asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const { user } = req;

    if (!currentPassword || !newPassword) {
      throw new BadRequestError('Contraseña actual y nueva requeridas');
    }

    if (!user) {
      throw new ForbiddenError('No autenticado');
    }

    await this.controller.changePassword(
      user.user.user_id!,
      currentPassword,
      newPassword,
      req.organization_id!
    );

    const response: APIResponse<boolean> = {
      data: {
        success: true,
      },
    };

    res.status(200).json(response);
  });

  /**
   * POST /api/private/user/unlock/:id
   * Admin endpoint to unlock a user account
   * Resets locked_until and failed_login_attempts
   * Only non-cashier users can unlock accounts
   */
  private unlockAccountHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id: targetUserId } = req.params;
    const { user } = req;

    if (!targetUserId) {
      throw new BadRequestError('ID de usuario requerido');
    }

    if (!user) {
      throw new ForbiddenError('No autenticado');
    }

    // Only non-cashier users can unlock accounts
    if (user.user.user_type === USER_TYPE.CASHIER) {
      throw new ForbiddenError('Los cajeros no pueden desbloquear cuentas');
    }

    await this.controller.unlockAccount(
      targetUserId,
      user.user.user_id!,
      user.user.user_type,
      user.user.name,
      req.organization_id!,
      req.ip,
      req.get('user-agent')
    );

    const response: APIResponse<boolean> = {
      data: { success: true },
    };

    res.status(200).json(response);
  });

  /**
   * GET /api/private/user/validate-capitalist?username=XXX&organization_id=YYY
   * Validate that a user exists and is CAPITALIST of the specified organization
   * Only accessible by OWNER
   */
  private validateCapitalistHandler = asyncHandler(async (req: Request, res: Response) => {
    const { username, organization_id } = req.query;
    const { user } = req;

    if (!username || typeof username !== 'string') {
      throw new BadRequestError('Username requerido');
    }

    if (!organization_id || typeof organization_id !== 'string') {
      throw new BadRequestError('ID de organización requerido');
    }

    if (!user) {
      throw new ForbiddenError('No autenticado');
    }

    // Only OWNER can validate CAPITALIST from other organizations
    if (user.user.user_type !== USER_TYPE.OWNER) {
      throw new ForbiddenError('Solo el OWNER puede validar CAPITALIST de otras organizaciones');
    }

    const result = await this.controller.validateCapitalist(
      username,
      organization_id,
      user.user.user_type
    );

    const response: APIResponse<string> = {
      data: {
        user_id: result.user_id,
      },
    };

    res.status(200).json(response);
  });

  /**
   * GET /api/private/user/assignable?exclude_group_id=XXX
   * Get users that can be assigned to groups
   * Only OWNER and CAPITALIST can access
   */
  private getAssignableUsersHandler = asyncHandler(async (req: Request, res: Response) => {
    const { exclude_group_id } = req.query;
    const { user } = req;

    if (!user) {
      throw new ForbiddenError('No autenticado');
    }

    const users = await this.controller.getUsersForGroupAssignment(
      req.organization_id!,
      user.user.user_type,
      exclude_group_id as string | undefined
    );

    const response: APIResponse<IUserEntityFront[]> = {
      data: {
        users,
      },
    };

    res.status(200).json(response);
  });

  /**
   * POST /api/private/user/remove-from-group
   * Remove a user from a group (move them back to parent organization)
   * Only OWNER and CAPITALIST can access
   * Body: { user_id: string, group_id: string }
   */
  private removeUserFromGroupHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user_id, group_id } = req.body;
    const { user } = req;

    if (!user_id || !group_id) {
      throw new BadRequestError('user_id y group_id son requeridos');
    }

    if (!user) {
      throw new ForbiddenError('No autenticado');
    }

    const result = await this.controller.removeUserFromGroup(
      user_id,
      group_id,
      req.organization_id!,
      user.user.user_type
    );

    const response: APIResponse<IUserEntityFront> = {
      data: {
        user: result,
      },
    };

    res.status(200).json(response);
  });

  /**
   * POST /api/private/user/assign-to-group
   * Assign a user to a group (change their organization_id)
   * Only OWNER and CAPITALIST can access
   * Body: { user_id: string, group_id: string }
   */
  private assignUserToGroupHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user_id, group_id } = req.body;
    const { user } = req;

    if (!user_id || !group_id) {
      throw new BadRequestError('user_id y group_id son requeridos');
    }

    if (!user) {
      throw new ForbiddenError('No autenticado');
    }

    const result = await this.controller.assignUserToGroup(
      user_id,
      group_id,
      req.organization_id!,
      user.user.user_type
    );

    const response: APIResponse<IUserEntityFront> = {
      data: {
        user: result,
      },
    };

    res.status(200).json(response);
  });
}
