import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const targetBase =
    process.env.API_BASE_URL ||
    process.env.API_BASE_URL_STAGING ||
    process.env.API_BASE_URL_DEV ||
    'http://localhost:3000';

  // req.url llega con /api/... por el rewrite
  const originalUrl = req.url || '/';
  const path = originalUrl.replace(/^\/api\//, '');
  const search = buildSearch(req);
  const targetUrl = `${stripTrailingSlash(targetBase)}/api/${path}${search}`;

  // Copiamos headers útiles (evitar hop-by-hop)
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    const key = k.toLowerCase();
    if (!['host', 'connection', 'content-length'].includes(key)) {
      headers.set(k, Array.isArray(v) ? v.join(', ') : String(v ?? ''));
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  // Body (leer crudo del stream si no es GET/HEAD)
  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    const chunks: Buffer[] = [];
    for await (const c of req as any as AsyncIterable<Buffer | string>) {
      chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
    }
    init.body = Buffer.concat(chunks);
  }

  const resp = await fetch(targetUrl, init);

  // Status + headers (incluye Set-Cookie)
  res.status(resp.status);
  resp.headers.forEach((value, key) => {
    if (!['transfer-encoding'].includes(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

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
