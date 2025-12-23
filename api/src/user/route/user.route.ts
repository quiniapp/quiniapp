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
    this.router.get('/:id', this.getUserHandler);
    this.router.get('/', this.getAllUserHandler);
    this.router.post('/', this.newUserhandler);
    // this.router.put('/reset/:id', this.updatePasswordHandler);
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
    const { cashier_number } = req.query;

    if (user?.user.user_type === USER_TYPE.CASHIER) {
      throw new ForbiddenError('Los cajeros no pueden listar usuarios');
    }

    let parsedCashierNumber: number | undefined = undefined;
    if (typeof cashier_number === 'string') {
      parsedCashierNumber = parseInt(cashier_number, 10);
    }

    const users = await this.controller.getAll(req.organization_id!, parsedCashierNumber);
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

  // private updatePasswordHandler: RequestHandler = async (req: Request, res: Response) => {
  //   const { id: user_id } = req.params;
  //   const { user } = req;
  //   if (!user_id) {
  //     const response: APIResponse<undefined> = {
  //       error: {
  //         error: ERROR_TYPE.BAD_REQUEST,
  //         message: ERROR_MESSAGE.BAD_REQUEST,
  //       },
  //     };
  //     res.status(403).json(response);
  //     return;
  //   }
  //   if (user?.user.user_type === USER_TYPE.CASHIER) {
  //     const response: APIResponse<undefined> = {
  //       error: {
  //         error: ERROR_TYPE.FORBIDDEN,
  //         message: ERROR_MESSAGE.FORBIDDEN,
  //       },
  //     };
  //     res.status(403).json(response);
  //     return;
  //   }
  //   try {
  //     const user = await this.controller.updatePassword(user_id);
  //     const response: APIResponse<IUserEntityFront> = {
  //       data: {
  //         user,
  //       },
  //     };
  //     res.status(200).json(response);
  //     return;
  //   } catch (error) {
  //     {
  //       if (error instanceof Error) {
  //         let statusCode = 500;
  //         if (
  //           error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
  //           error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
  //         ) {
  //           statusCode = 401;
  //         }

  //         const response: APIResponse<null> = {
  //           error: {
  //             error: ERROR_TYPE.AUTH_ERROR,
  //             message: error.message,
  //           },
  //         };
  //         res.status(statusCode).json(response);
  //         return;
  //       }
  //     }
  //   }
  // };
}
