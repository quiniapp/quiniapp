import crypto from 'crypto';
import { JWT_SECRET_ACCESS, JWT_SECRET_REFRESH } from 'api/envs';
import { SESSION_CONFIG } from 'api/src/config/session.config';
import {
  POLLA_ACCESS_TOKEN_COOKIE,
  POLLA_REFRESH_TOKEN_COOKIE,
  POLLA_ACCESS_TOKEN_TTL,
  POLLA_REFRESH_TOKEN_TTL,
  POLLA_ACCESS_TOKEN_MAX_AGE_MS,
  POLLA_REFRESH_TOKEN_MAX_AGE_MS,
  POLLA_SESSION_DURATION_MS,
  POLLA_ACTIVITY_WRITE_THROTTLE_MS,
  POLLA_MAX_FAILED_LOGIN_ATTEMPTS,
  POLLA_ACCOUNT_LOCKOUT_MS,
} from '@helper/polla/config/session.config';

/**
 * Los secretos de Polla son propios. Si no vienen por env se derivan de los de
 * QuiniApp: material de clave distinto (así un token de una app no vale en la
 * otra) sin obligar a tocar el deploy antes de subir esto.
 */
const derive = (base: string, label: string) =>
  crypto.createHash('sha256').update(`${base}|${label}`).digest('hex');

export const POLLA_JWT_SECRET_ACCESS =
  process.env.POLLA_JWT_SECRET_ACCESS ?? derive(String(JWT_SECRET_ACCESS), 'polla-access');

export const POLLA_JWT_SECRET_REFRESH =
  process.env.POLLA_JWT_SECRET_REFRESH ?? derive(String(JWT_SECRET_REFRESH), 'polla-refresh');

export const POLLA_SESSION_CONFIG = {
  ACCESS_TOKEN_COOKIE_NAME: POLLA_ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_NAME: POLLA_REFRESH_TOKEN_COOKIE,
  JWT_ACCESS_EXPIRATION: process.env.POLLA_JWT_ACCESS_EXPIRATION || POLLA_ACCESS_TOKEN_TTL,
  JWT_REFRESH_EXPIRATION: process.env.POLLA_JWT_REFRESH_EXPIRATION || POLLA_REFRESH_TOKEN_TTL,
  ACCESS_TOKEN_MAX_AGE_MS: POLLA_ACCESS_TOKEN_MAX_AGE_MS,
  REFRESH_TOKEN_MAX_AGE_MS: POLLA_REFRESH_TOKEN_MAX_AGE_MS,
  INACTIVITY_TIMEOUT_MS: POLLA_SESSION_DURATION_MS,
  ACTIVITY_WRITE_THROTTLE_MS: POLLA_ACTIVITY_WRITE_THROTTLE_MS,
  MAX_FAILED_LOGIN_ATTEMPTS: POLLA_MAX_FAILED_LOGIN_ATTEMPTS,
  ACCOUNT_LOCKOUT_MS: POLLA_ACCOUNT_LOCKOUT_MS,
  BCRYPT_ROUNDS: SESSION_CONFIG.BCRYPT_ROUNDS,
};

/** Mismas opciones de cookie que QuiniApp: httpOnly + secure + sameSite por env. */
export const pollaCookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  secure: SESSION_CONFIG.COOKIE_SECURE,
  sameSite: SESSION_CONFIG.COOKIE_SAME_SITE,
  domain: SESSION_CONFIG.COOKIE_DOMAIN,
  path: '/',
  maxAge: maxAgeMs,
});
