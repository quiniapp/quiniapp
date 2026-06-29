import { Router, Request, Response } from 'express';
import { supabase } from '@database/db.connection';
import { INSTANCE_NAME } from 'api/envs';

/**
 * Health endpoints for the high-availability setup (Railway main + Render backup).
 *
 * Mounted BEFORE auth, rate-limit and CSRF so it is public, cheap and unthrottled.
 * Must be reachable directly on the backend host (e.g. https://<render-host>/health),
 * not only through the Vercel proxy, so the keep-warm pinger and uptime monitors can hit it.
 */
export const healthRouter = Router();

/**
 * Shallow liveness check. Used by the keep-warm pinger and uptime monitors.
 * Returns 200 as long as the process is up — does NOT touch the database.
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    instance: INSTANCE_NAME,
    uptime: process.uptime(),
  });
});

/**
 * Deep readiness check. Verifies Supabase connectivity with a cheap query.
 * Returns 503 when the database is unreachable. For monitoring/alerting only —
 * the proxy failover does NOT poll this; it reacts to connection errors per request.
 */
healthRouter.get('/health/deep', async (_req: Request, res: Response) => {
  try {
    const { error } = await supabase.from('sessions').select('session_id').limit(1);
    if (error) throw error;

    res.status(200).json({
      status: 'ok',
      instance: INSTANCE_NAME,
      db: 'up',
      uptime: process.uptime(),
    });
  } catch {
    res.status(503).json({
      status: 'error',
      instance: INSTANCE_NAME,
      db: 'down',
    });
  }
});
