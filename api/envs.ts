import 'dotenv/config';

/**
 * Convenciones de ENV
 * - ENVIROMENT: 'LOCAL' | 'DEV' | 'STAGING' | 'PRODUCTION' (o lo que uses)
 * - FRONT_URL_ENVIROMENT: 'PRODUCTION' | 'DEVELOP'
 * - SUPABASE_ENVIROMENT: 'LOCAL' | 'REMOTE'
 * - ALLOW_VERCEL_PREVIEWS: 'true' | 'false'
 * - CORS_EXTRA_ORIGINS: lista separada por comas (opcional)
 */

const ENVIROMENT = process.env.ENVIROMENT ?? 'LOCAL';
const DATABASE_ENVIROMENT = process.env.SUPABASE_ENVIROMENT ?? 'LOCAL';
const FRONT_URL_ENVIROMENT = process.env.FRONT_URL_ENVIROMENT ?? 'DEVELOP';

export const NODE_ENV =
  process.env.NODE_ENV ?? (ENVIROMENT === 'PRODUCTION' ? 'production' : 'development');

// Flags útiles
export const IS_LOCAL = ENVIROMENT === 'LOCAL';
export const IS_PRODUCTION = NODE_ENV === 'production' || ENVIROMENT === 'PRODUCTION';

// JWT Secrets for custom authentication (Phase 1)
export const JWT_SECRET_ACCESS = must(process.env.JWT_SECRET_ACCESS, 'JWT_SECRET_ACCESS');
export const JWT_SECRET_REFRESH = must(process.env.JWT_SECRET_REFRESH, 'JWT_SECRET_REFRESH');

// API
export const PORT = Number(IS_LOCAL ? 3000 : (process.env.PORT ?? 3000));
export const BACKEND_URL = IS_LOCAL ? 'http://localhost' : must(process.env.URL, 'URL'); // hostname/base URL (sin puerto si usás reverse proxy)

// DB (Supabase)
export const SUPABASE_URL = must(
  DATABASE_ENVIROMENT === 'LOCAL' ? process.env.SUPABASE_URL_LOCAL : process.env.SUPABASE_URL,
  DATABASE_ENVIROMENT === 'LOCAL' ? 'SUPABASE_URL_LOCAL' : 'SUPABASE_URL'
);

export const SUPABASE_SERVICE_ROLE_KEY = must(
  DATABASE_ENVIROMENT === 'LOCAL'
    ? process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL
    : process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_ENVIROMENT === 'LOCAL' ? 'SUPABASE_SERVICE_ROLE_KEY_LOCAL' : 'SUPABASE_SERVICE_ROLE_KEY'
);

export const JWT_SECRET_SUPABASE = must(
  DATABASE_ENVIROMENT === 'LOCAL'
    ? process.env.JWT_SECRET_SUPABASE_LOCAL
    : process.env.JWT_SECRET_SUPABASE,
  DATABASE_ENVIROMENT === 'LOCAL' ? 'JWT_SECRET_SUPABASE_LOCAL' : 'JWT_SECRET_SUPABASE'
);

// Frontend
export const FRONT_URL = must(
  FRONT_URL_ENVIROMENT === 'PRODUCTION'
    ? process.env.FRONT_URL_PRODUCTION
    : process.env.FRONT_URL_DEVELOP,
  FRONT_URL_ENVIROMENT === 'PRODUCTION' ? 'FRONT_URL_PRODUCTION' : 'FRONT_URL_DEVELOP'
);

// Útiles para CORS
export const FRONT_URL_DEV = process.env.FRONT_URL_DEV ?? 'http://localhost:5173';
export const ALLOW_VERCEL_PREVIEWS =
  (process.env.ALLOW_VERCEL_PREVIEWS ?? 'false').toLowerCase() === 'true';

// Permite agregar orígenes extra (coma-separados)
export const CORS_EXTRA_ORIGINS = (process.env.CORS_EXTRA_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Helper: valida envs obligatorios
function must<T extends string | undefined>(val: T, name: string): string {
  if (!val) throw new Error(`Missing required env: ${name}`);
  return String(val);
}

// Organization
export const DEFAULT_ORG_ID = must(process.env.DEFAULT_ORG_ID, 'DEFAULT_ORG_ID');

export const ARCHIVE_DAYS_TO_KEEP = parseInt(process.env.ARCHIVE_DAYS_TO_KEEP || '2');

// =====================================
// High Availability (Railway main + Render backup)
// =====================================

// Human-readable identifier for this instance (e.g. 'railway' | 'render'). Surfaced by /health.
export const INSTANCE_NAME = process.env.INSTANCE_NAME ?? 'main';

// Whether this instance runs the singleton background jobs (archive cron, session cleanup).
// Default true so the existing single-instance deploy is unaffected. Set to false on the
// passive backup (Render) so those jobs only run on the main (Railway) instance.
export const ENABLE_BACKGROUND_JOBS =
  (process.env.ENABLE_BACKGROUND_JOBS ?? 'true').toLowerCase() === 'true';

// Public /health URL of the backup instance. The main instance pings it periodically to keep
// the Render free tier warm. Optional — keep-warm is skipped when unset.
export const BACKUP_HEALTH_URL = process.env.BACKUP_HEALTH_URL ?? '';
