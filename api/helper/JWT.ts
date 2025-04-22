import jwt from 'jsonwebtoken';
import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } from '../envs';

export class JWT {
  private static ACCESS_TOKEN_SECRET = ACCESS_TOKEN_SECRET;
  private static REFRESH_TOKEN_SECRET = REFRESH_TOKEN_SECRET;

  static generateAccessToken(payload: object, expiresIn = '15m') {
    return jwt.sign(payload, JWT.ACCESS_TOKEN_SECRET, { expiresIn });
  }

  static generateRefreshToken(payload: object, expiresIn = '7d') {
    return jwt.sign(payload, JWT.REFRESH_TOKEN_SECRET, { expiresIn });
  }

  static verifyAccessToken(token: string) {
    return jwt.verify(token, JWT.ACCESS_TOKEN_SECRET);
  }

  static verifyRefreshToken(token: string) {
    return jwt.verify(token, JWT.REFRESH_TOKEN_SECRET);
  }
}
