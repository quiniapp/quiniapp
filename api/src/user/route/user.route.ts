import { Request, RequestHandler, Response, Router } from 'express';
import { UserController } from '../controller/user.controller';
import { INewUserEntity } from '@helper/request/user.response';
import { APIResponse } from '@helper/response/api_response.response';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { USER_TYPE } from '@helper/types/user.type';
import { z } from 'zod';

export class UserRouter {
  public router: Router;

  private controller: UserController;

  constructor() {
    this.router = Router();
    this.controller = new UserController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/:id', this.controller.get);
    this.router.get('/', this.controller.getAll);
    this.router.post('/', this.controller.create);
    this.router.put('/:id', this.controller.update);
    this.router.delete('/:id', this.controller.delete);
  }
  private newUserhandler: RequestHandler = async (req: Request, res: Response) => {
    try{

      const { newUser }: { newUser: INewUserEntity } = req.body;
      if (!newUser.username) {
        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.USERNAME_IS_REQUIRED,
            message: ERROR_MESSAGE.USERNAME_IS_REQUIRED,
          },
        };
        res.status(400).json(response);
        return;
      }
      if(newUser.user_type===USER_TYPE.CASHIER){
        
      }else{
        
      }
      
    }catch(error){
      if (error instanceof Error) {
        let statusCode = 500;
        if (1
          // error.message === ERROR_MESSAGE.USER_NOT_FOUND ||
          // error.message === ERROR_MESSAGE.INVALID_CREDENTIALS
        ) {
          statusCode = 401;
        }

        const response: APIResponse<null> = {
          error: {
            error: ERROR_TYPE.AUTH_ERROR,
            message: error.message,
          },
        };
        res.status(statusCode).json(response);
        return;
      }

      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.INTERNAL_SERVER_ERROR,
          message: 'Unexpected error',
        },
      };
      res.status(500).json(response);
    }
    }
  };

export const newUserCashierSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export const updateCashierSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  token: z.string().min(1, 'Password is required'),
});
export const newUserSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export const updateUserSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  token: z.string().min(1, 'Password is required'),
});