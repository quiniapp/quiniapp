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
    // Validate SUPERADMIN for cross-org password reset
    this.router.get('/validate-superadmin', this.validateSuperAdminHandler);

    // Password Management (Phase 3)
    this.router.post('/change-password', this.changePasswordHandler);
    this.router.post('/reset-password/:id', this.resetPasswordHandler);

    // Standard CRUD routes
    this.router.get('/:id', this.getUserHandler);
    this.router.get('/', this.getAllUserHandler);
    this.router.post('/', this.newUserhandler);
    this.router.put('/:id', this.updateUserHandler);
    this.router.delete('/:id', this.deleteUserHandler);
  }

  private newUserhandler = asyncHandler(async (req: Request, res: Response) => {
    const { newUser }: { newUser: INewUserEntity } = req.body;

    if (!newUser) {
      throw new BadRequestError('Datos del nuevo usuario requeridos');
    }

    if (newUser?.user_type === USER_TYPE.OWNER) {
      throw new ForbiddenError('No se puede crear un usuario de tipo OWNER');
    }

    const user = await this.controller.create(newUser, req.organization_id!);

    const response: APIResponse<IUserEntityFront> = {
      data: {
        user: user!,
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

    const fetchedUser = await this.controller.get({ user_id }, req.organization_id!);

    const response: APIResponse<IUserEntityFront> = {
      data: {
        user: fetchedUser,
      },
    };
    res.status(200).json(response);
  });
  private getAllUserHandler = asyncHandler(async (req: Request, res: Response) => {
    const { user } = req;
    const { cashier_number, filter_user_type } = req.query;

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

    const users = await this.controller.getAll(
      req.organization_id!,
      user!.user.user_type,
      parsedCashierNumber,
      filterUserType
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

    const updatedUser = await this.controller.update(user_id, updateUser, req.organization_id!);

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

    const deletedUser = await this.controller.delete({ user_id }, req.organization_id!);

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
   * Only OWNER, SUPERADMIN, and ADMIN can reset passwords
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

    // Check permissions - only OWNER, SUPERADMIN, ADMIN can reset passwords
    if (![USER_TYPE.OWNER, USER_TYPE.SUPERADMIN, USER_TYPE.ADMIN].includes(user.user.user_type)) {
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
   * GET /api/private/user/validate-superadmin?username=XXX&organization_id=YYY
   * Validate that a user exists and is SUPERADMIN of the specified organization
   * Only accessible by OWNER
   */
  private validateSuperAdminHandler = asyncHandler(async (req: Request, res: Response) => {
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

    // Only OWNER can validate SUPERADMIN from other organizations
    if (user.user.user_type !== USER_TYPE.OWNER) {
      throw new ForbiddenError('Solo el OWNER puede validar SUPERADMIN de otras organizaciones');
    }

    const result = await this.controller.validateSuperAdmin(
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
}
