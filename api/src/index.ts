import express, { Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { isAuthenticated } from '../middlewares/auth.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { publicRouter, router } from './router';
import { startSessionCleanupJob } from './utils/session-cleanup.job';
import {
  loginRateLimiter,
  authRateLimiter,
  publicApiRateLimiter,
  privateApiRateLimiter,
} from './middlewares/rate-limit.middleware';

import {
  PORT,
  BACKEND_URL,
  NODE_ENV,
  IS_LOCAL,
  IS_PRODUCTION,
  FRONT_URL,
  FRONT_URL_DEV,
  ALLOW_VERCEL_PREVIEWS,
  CORS_EXTRA_ORIGINS,
} from 'api/envs';
import { URL } from 'url';

const app = express();

// Si estás detrás de Vercel/NGINX/Cloudflare: cookies Secure y X-Forwarded-* correctos
app.set('trust proxy', 1);

// ---- CORS ----
const baseAllowedOrigins = [
  FRONT_URL, // tu front principal (prod o dev según env)
  !IS_PRODUCTION ? FRONT_URL_DEV : undefined, // vite dev server solo si no es prod
  !IS_PRODUCTION ? 'http://localhost:3000' : undefined, // otra app local si necesitás
  !IS_PRODUCTION ? 'http://127.0.0.1:5173' : undefined,
  ...CORS_EXTRA_ORIGINS, // extras por env
].filter(Boolean) as string[];

const isAllowedOrigin = (origin?: string | null) => {
  if (!origin) return true; // para requests server->server, curl, etc.
  if (baseAllowedOrigins.includes(origin)) return true;

  // Opcional: permitir previews *.vercel.app
  if (ALLOW_VERCEL_PREVIEWS) {
    try {
      const u = new URL(origin);
      if (u.hostname.endsWith('.vercel.app')) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
};

const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Añadimos Vary para caches
app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});
app.use(corsMiddleware);
app.options('*', corsMiddleware); // preflight

// ---- Middlewares globales ----
// Custom Morgan token para mostrar info de errores en logs
morgan.token('error-info', (req, res) => {
  // Type assertion: Morgan usa tipos de http nativo, pero Express agrega locals
  const expressRes = res as unknown as Response;
  if (expressRes.locals?.errorInfo && expressRes.statusCode >= 400) {
    const { code, message } = expressRes.locals.errorInfo;
    // Truncar mensaje a 100 chars para logs limpios
    const truncatedMsg = message.length > 100 ? message.substring(0, 97) + '...' : message;
    return `[${code}: ${truncatedMsg}]`;
  }
  return '';
});

// Formato custom que incluye error-info para producción
const morganFormat = IS_LOCAL
  ? 'dev'
  : ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] :error-info ":referrer" ":user-agent"';

app.use(morgan(morganFormat));
app.use(cookieParser());

// ---- Rate Limiters (ANTES de body parsers, más específicos primero) ----
app.use('/api/auth/login', loginRateLimiter); // Login (más estricto)
app.use('/api/auth', authRateLimiter); // Otros endpoints de auth

// ---- Body parsers por ruta (con rate limiters) ----
app.use(
  '/api/private',
  privateApiRateLimiter,
  express.json({ limit: '5mb' }),
  isAuthenticated,
  router
);
app.use('/api', publicApiRateLimiter, express.json({ limit: '200kb' }), publicRouter);

// ---- 404 Handler ----
app.use((req, res) => {
  const errorMessage = `Ruta ${req.path} no encontrada`;
  // Guardar info para Morgan custom token
  res.locals.errorInfo = {
    code: 'NOT_FOUND',
    message: errorMessage,
    statusCode: 404,
  };
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: errorMessage,
    },
  });
});

// ---- Error Handler (DEBE SER EL ÚLTIMO MIDDLEWARE) ----
app.use(errorHandler);

// ---- Arranque ----
app.listen(PORT, () => {
  console.log(`Servidor corriendo en ${BACKEND_URL}:${PORT} [node_env=${NODE_ENV}]`);
  console.log('[CORS] allowed origins:', baseAllowedOrigins);
  if (ALLOW_VERCEL_PREVIEWS) console.log('[CORS] Vercel previews habilitadas (*.vercel.app)');

  // Start session cleanup job (runs every hour)
  startSessionCleanupJob();
});
