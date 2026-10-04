/**
 * Configuración de sesión de la Polla, compartida entre `api/src/polla` y
 * `polla-web`.
 *
 * Los nombres de cookie TIENEN que ser distintos de los de QuiniApp: las dos
 * apps pegan contra el mismo dominio de API y, con el mismo nombre, una
 * pisaría la sesión de la otra.
 */

export const POLLA_ACCESS_TOKEN_COOKIE = 'polla_access_token';
export const POLLA_REFRESH_TOKEN_COOKIE = 'polla_refresh_token';

/** Vida del access token. El refresh token lo renueva en silencio. */
export const POLLA_ACCESS_TOKEN_TTL = '15m';
export const POLLA_REFRESH_TOKEN_TTL = '30d';

export const POLLA_ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
export const POLLA_REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Sesión por inactividad: se extiende con cada request. */
export const POLLA_SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

/** Cada cuánto el front revalida la sesión contra el backend. */
export const POLLA_VALIDATE_INTERVAL_MS = 5 * 60 * 1000;

/** Cada cuánto el front refresca el access token de forma preventiva. */
export const POLLA_REFRESH_INTERVAL_MS = 13 * 60 * 1000;

/** Solo se persiste `last_activity_at` si pasó al menos este tiempo. */
export const POLLA_ACTIVITY_WRITE_THROTTLE_MS = 60 * 1000;

export const POLLA_MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const POLLA_ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000;

/** Paginación por defecto de todos los getAll. */
export const POLLA_DEFAULT_PAGE_SIZE = 50;
export const POLLA_MAX_PAGE_SIZE = 200;
