import { JwtPayload } from '@supabase/supabase-js';
import { JWT_SECRET } from 'api/envs';
import jwt from 'jsonwebtoken';

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};
