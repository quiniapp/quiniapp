import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { isAuthenticated } from '../middlewares/auth.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { publicRouter, router } from './router';

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
app.use(morgan(IS_LOCAL ? 'dev' : 'combined'));
app.use(cookieParser());

// ---- Body parsers por ruta ----
app.use('/api/private', express.json({ limit: '5mb' }), isAuthenticated, router);
app.use('/api', express.json({ limit: '200kb' }), publicRouter);

// ---- 404 Handler ----
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Ruta ${req.path} no encontrada`,
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
});
