// /api/api-proxy.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Reverse proxy with transparent failover for the high-availability setup.
 *
 * The browser only ever talks to this serverless function (same-origin). It forwards to the
 * MAIN backend (Railway, API_BASE_URL); if that is unreachable it retries the BACKUP backend
 * (Render, API_BASE_URL_BACKUP). Cookies stay same-origin, so the switch is invisible to the
 * client and the session survives (both backends share the same Supabase + JWT secrets).
 *
 * Failover policy is conservative to avoid duplicate writes:
 *  - SAFE methods (GET/HEAD): fail over on any primary failure (connection error, timeout, 5xx).
 *  - Mutations (POST/PUT/PATCH/DELETE): fail over ONLY when the request provably never reached
 *    the primary (connection-level errors). A timeout or 5xx is NOT retried — the primary may
 *    have already processed it.
 */

// How long to wait for the primary before giving up on it.
const PRIMARY_TIMEOUT_MS = 4000;
// After a connection-level primary failure, skip the primary for this long (warm-instance only).
const CIRCUIT_OPEN_MS = 30_000;

// Module-level circuit breaker. Persists only within a warm serverless instance, which is
// enough to avoid paying the primary timeout on every request during a sustained outage.
let primaryDownUntil = 0;

const SAFE_METHODS = new Set(['GET', 'HEAD']);

// fetch() error codes that mean the request never left this side / never reached the server.
// Safe to retry on the backup even for mutations.
const NOT_DELIVERED_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

function isNotDelivered(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } })?.cause?.code;
  if (!code) return false;
  if (NOT_DELIVERED_CODES.has(code)) return true;
  // TLS/certificate handshake failures also happen before the request is sent.
  if (code.startsWith('CERT_') || code.includes('SELF_SIGNED') || code.includes('UNABLE_TO_VERIFY')) {
    return true;
  }
  return false;
}

const GATEWAY_STATUSES = new Set([502, 503, 504]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const primaryBase =
    process.env.API_BASE_URL ||
    process.env.API_BASE_URL_STAGING ||
    process.env.API_BASE_URL_DEV ||
    'http://localhost:3000';
  const backupBase = process.env.API_BASE_URL_BACKUP || '';

  const originalUrl = req.url || '/';
  const url = new URL(originalUrl, 'http://proxy.local'); // base dummy
  const path = url.pathname.replace(/^\/api\//, '');
  const search = buildSearch(req);
  const targetPath = `/api/${path}${search}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    const key = k.toLowerCase();
    if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(key)) {
      headers.set(k, Array.isArray(v) ? v.join(', ') : String(v ?? ''));
    }
  }

  const method = (req.method || 'GET').toUpperCase();
  const isSafe = SAFE_METHODS.has(method);

  // Buffer the body ONCE into a Buffer so it can be reused across primary + backup attempts.
  let body: Buffer | undefined;
  if (!['GET', 'HEAD'].includes(method)) {
    const chunks: Buffer[] = [];
    for await (const c of req as unknown as AsyncIterable<Buffer | string>) {
      chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
    }
    body = Buffer.concat(chunks);
  }

  const buildInit = (signal?: AbortSignal): RequestInit => ({
    method,
    headers,
    redirect: 'manual',
    body,
    signal,
  });

  // Try the primary unless the circuit is open (recent connection failure).
  const circuitOpen = backupBase && Date.now() < primaryDownUntil;

  if (!circuitOpen) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PRIMARY_TIMEOUT_MS);
    try {
      const resp = await fetch(`${stripTrailingSlash(primaryBase)}${targetPath}`, buildInit(controller.signal));
      clearTimeout(timer);
      primaryDownUntil = 0; // primary answered → close the circuit

      // Gateway error from primary: fail over only for SAFE methods.
      if (backupBase && isSafe && GATEWAY_STATUSES.has(resp.status)) {
        const backupResp = await tryBackup(backupBase, targetPath, buildInit);
        if (backupResp) return sendResponse(res, backupResp);
      }
      return sendResponse(res, resp);
    } catch (err) {
      clearTimeout(timer);
      const notDelivered = isNotDelivered(err);
      if (notDelivered) primaryDownUntil = Date.now() + CIRCUIT_OPEN_MS;

      // Fail over to backup when allowed by the conservative policy.
      const mayFailover = backupBase && (isSafe || notDelivered);
      if (mayFailover) {
        const backupResp = await tryBackup(backupBase, targetPath, buildInit);
        if (backupResp) return sendResponse(res, backupResp);
      }
      return sendUnavailable(res);
    }
  }

  // Circuit open: go straight to the backup.
  const backupResp = await tryBackup(backupBase, targetPath, buildInit);
  if (backupResp) return sendResponse(res, backupResp);
  return sendUnavailable(res);
}

async function tryBackup(
  backupBase: string,
  targetPath: string,
  buildInit: (signal?: AbortSignal) => RequestInit
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRIMARY_TIMEOUT_MS);
  try {
    const resp = await fetch(`${stripTrailingSlash(backupBase)}${targetPath}`, buildInit(controller.signal));
    return resp;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function sendResponse(res: VercelResponse, resp: Response): Promise<void> {
  res.status(resp.status);

  resp.headers.forEach((value, key) => {
    if (!['transfer-encoding', 'content-length', 'set-cookie', 'content-encoding'].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const anyHeaders = resp.headers as unknown as {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };
  const setCookies: string[] =
    (typeof anyHeaders.getSetCookie === 'function' && anyHeaders.getSetCookie()) ||
    (anyHeaders.raw && anyHeaders.raw()['set-cookie']) ||
    (resp.headers.get('set-cookie') ? [resp.headers.get('set-cookie') as string] : []);
  if (setCookies?.length) res.setHeader('Set-Cookie', setCookies);

  const buf = Buffer.from(await resp.arrayBuffer());
  res.end(buf);
}

function sendUnavailable(res: VercelResponse): void {
  res.status(502).setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      error: {
        code: 'BACKEND_UNAVAILABLE',
        message: 'El servidor no está disponible en este momento. Reintente en unos segundos.',
      },
    })
  );
}

function stripTrailingSlash(s: string) {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

function buildSearch(req: VercelRequest) {
  const q = req.query || {};
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (Array.isArray(v)) for (const it of v) usp.append(k, String(it));
    else if (v != null) usp.append(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}
