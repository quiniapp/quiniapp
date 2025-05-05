import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } from 'api/envs';
import jwt from 'jsonwebtoken';

export class JWT {
  static generateAccessToken(payload: object) {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
  }

  static generateRefreshToken(payload: object) {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: '2h' });
  }

  static verifyAccessToken(token: string) {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  }

  static verifyRefreshToken(token: string) {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  }
}
