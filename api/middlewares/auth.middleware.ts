import { verifyUserToken } from 'api/helper/JWT';
import { Request, Response, NextFunction } from 'express';
import { ITokenPayload } from '@helper/types/auth.type';
import { IUserEntityFront } from '@helper/types/user.type';
import { UnauthorizedError } from '@helper/errors';
import { asyncHandler } from 'api/src/middlewares/error.middleware';

declare module 'express' {
  export interface Request {
    user?: ITokenPayload;
    organization_id?: string;
  }
}

export const isAuthenticated = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authToken = req.cookies.access_token;
    const userToken = req.cookies.user_token;

    if (!authToken || !userToken) {
      throw new UnauthorizedError('No autenticado');
    }

    const userDecoded = verifyUserToken(userToken);

    if (!userDecoded) {
      throw new UnauthorizedError('Token de usuario inválido');
    }

    const user = userDecoded as IUserEntityFront;
    req.user = {
      user,
      token: authToken,
      organization_id: userDecoded.organization_id,
    };
    req.organization_id = userDecoded.organization_id;

    next();
  }
);
