import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } from 'api/envs';
import jwt from 'jsonwebtoken';

export class JWT {
  private static ACCESS_TOKEN_SECRET = ACCESS_TOKEN_SECRET;
  private static REFRESH_TOKEN_SECRET = REFRESH_TOKEN_SECRET;

  static generateAccessToken(payload: object) {
    return jwt.sign(payload, JWT.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
  }

  static generateRefreshToken(payload: object) {
    return jwt.sign(payload, JWT.REFRESH_TOKEN_SECRET, { expiresIn: '12h' });
  }

  static verifyAccessToken(token: string) {
    return jwt.verify(token, JWT.ACCESS_TOKEN_SECRET);
  }

  static verifyRefreshToken(token: string) {
    return jwt.verify(token, JWT.REFRESH_TOKEN_SECRET);
  }
}
