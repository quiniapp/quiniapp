import { verifyUserToken } from 'api/helper/JWT';
import { Request, Response, NextFunction } from 'express';
import { APIResponse } from '@helper/response/api_response.response';
import { ITokenPayload } from '@helper/types/auth.type';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
import { IUserEntityFront } from '@helper/types/user.type';

declare module 'express' {
  export interface Request {
    user?: ITokenPayload;
  }
}

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authToken = req.cookies.access_token;
  const userToken = req.cookies.user_token;

  if (!authToken) {
    const response: APIResponse<null> = {
      error: {
        error: ERROR_TYPE.TOKEN_ERROR,
        message: ERROR_MESSAGE.TOKEN_ERROR,
      },
    };
    res.status(400).json(response);
    return;
  }

  try {
    const userDecoded = verifyUserToken(userToken);
    req.user = {
      user: userDecoded as unknown as IUserEntityFront,
      token: authToken,
    };

    next();
  } catch (err) {
    console.error('authMiddleware', err);
    const response: APIResponse<null> = {
      error: {
        error: ERROR_TYPE.TOKEN_ERROR,
        message: ERROR_MESSAGE.TOKEN_ERROR,
      },
    };
    res.status(401).json(response);
    return;
  }
};
