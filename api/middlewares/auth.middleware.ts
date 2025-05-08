import { APIResponse } from '@helper/response/api_response.response';
import { ITokenPayload } from '@helper/types/auth.type';
import { ERROR_MESSAGE, ERROR_TYPE } from '@helper/types/errors.type';
// import { supabase } from 'api/database/db.connection';
import { ACCESS_TOKEN_SECRET } from 'api/envs';
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

declare module 'express' {
  export interface Request {
    user?: ITokenPayload;
  }
}

export const isAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  const authToken = req.headers.authorization;

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
    const decoded = jwt.verify(authToken, ACCESS_TOKEN_SECRET) as JwtPayload;

    // opcional: validar campos requeridos
    if (!decoded.user_id || !decoded.user_type) {
      const response: APIResponse<null> = {
        error: {
          error: ERROR_TYPE.TOKEN_ERROR,
          message: ERROR_MESSAGE.TOKEN_ERROR,
        },
      };
      res.status(403).json(response);
      return;
    }

    // Guardamos los datos en req
    req.user = {
      user_id: decoded.user_id,
      user_type: decoded.user_type,
      name: decoded.name,
      number: decoded.number,
      username: decoded.username,
      cashier_type: decoded?.cashier_type,
    };

    next();
  } catch (err) {
    console.error(err);
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
/* 
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const supabaseServerClient = createMiddlewareSupabaseClient({ req, res }, supabase);

  const {
    data: { user },
    error,
  } = await supabaseServerClient.auth.getUser();

  if (!user || error) {
    const response: APIResponse<null> = {
      error: {
        error: ERROR_TYPE.TOKEN_ERROR,
        message: ERROR_MESSAGE.TOKEN_ERROR,
      },
    };
    return res.status(401).json(response);
  }

  // Adjuntamos el usuario al request para usarlo luego
  req.user = {
    user_id: user.id,
    user_type: user.user_metadata?.user_type,
    name: user.user_metadata?.name,
    number: user.user_metadata?.number,
    username: user.user_metadata?.username,
    cashier_type: user.user_metadata?.cashier_type,
  };

  return next();
};
 */
