import { IUserEntityFront } from 'helper/types/user.type';
import { JwtPayload } from '@supabase/supabase-js';
import { JWT_SECRET_SUPABASE, JWT_SECRET_USER } from 'api/envs';
import jwt, { SignOptions } from 'jsonwebtoken';

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET_SUPABASE) as JwtPayload;
};

export const signUserToken = (payload: IUserEntityFront, options?: SignOptions): string => {
  return jwt.sign(payload, JWT_SECRET_USER, options);
};

export const verifyUserToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET_USER) as JwtPayload;
};
