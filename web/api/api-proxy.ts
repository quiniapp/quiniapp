// /api/api-proxy.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const targetBase =
    process.env.API_BASE_URL ||
    process.env.API_BASE_URL_STAGING ||
    process.env.API_BASE_URL_DEV ||
    'http://localhost:3000';

  const originalUrl = req.url || '/';

  // ✅ Parsear correctamente
  const url = new URL(originalUrl, 'http://proxy.local'); // base dummy
  const path = url.pathname.replace(/^\/api\//, '');

  // Opción A: reconstruir del objeto query (suele ser lo más predecible)
  const search = buildSearch(req);

  // Opción B (alternativa): usar lo que vino tal cual en la URL:
  // const search = url.search || '';

  const targetUrl = `${stripTrailingSlash(targetBase)}/api/${path}${search}`;

  // (opcional) te dejo un log útil para verificar
  // console.log({ originalUrl, path, search, targetUrl });

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    const key = k.toLowerCase();
    if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(key)) {
      headers.set(k, Array.isArray(v) ? v.join(', ') : String(v ?? ''));
    }
  }

  const init: RequestInit = { method: req.method, headers, redirect: 'manual' };

  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    const chunks: Buffer[] = [];
    for await (const c of (req as any as AsyncIterable<Buffer | string>)) {
      chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
    }
    init.body = Buffer.concat(chunks);
  }

  const resp = await fetch(targetUrl, init);

  res.status(resp.status);

  resp.headers.forEach((value, key) => {
    if (!['transfer-encoding', 'content-length', 'set-cookie'].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const anyHeaders = resp.headers as any;
  const setCookies: string[] =
    (typeof anyHeaders.getSetCookie === 'function' && anyHeaders.getSetCookie()) ||
    (anyHeaders.raw && anyHeaders.raw()['set-cookie']) ||
    (resp.headers.get('set-cookie') ? [resp.headers.get('set-cookie') as string] : []);
  if (setCookies?.length) res.setHeader('Set-Cookie', setCookies);

  const buf = Buffer.from(await resp.arrayBuffer());
  res.end(buf);
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
