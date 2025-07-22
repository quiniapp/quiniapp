import { IUserEntityFront } from '@helper/types/user.type';
import { JwtPayload } from '@supabase/supabase-js';
import { JWT_SECRET_USER } from 'api/envs';
import jwt, { SignOptions } from 'jsonwebtoken';

function isJwtPayload(payload: any): payload is JwtPayload {
  return typeof payload === 'object' && payload !== null && 'exp' in payload;
}

export const verifyAccessToken = (token: string): JwtPayload => {
  const decoded = verifyUserToken(token);
  if (!isJwtPayload(decoded)) throw new Error('Invalid token');
  return decoded;
};

export const signUserToken = (payload: IUserEntityFront, options?: SignOptions): string => {
  return jwt.sign(payload, JWT_SECRET_USER, options);
};

export const verifyUserToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET_USER) as JwtPayload;
};
