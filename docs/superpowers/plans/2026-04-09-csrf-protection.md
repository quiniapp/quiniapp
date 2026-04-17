# CSRF Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar protección CSRF explícita con tokens usando el patrón Double Submit Cookie, complementando la protección actual basada en `sameSite: lax`.

**Architecture:** Se usa la librería `csrf-csrf` (Double Submit Cookie). El backend expone `GET /api/csrf-token` que genera y setea una cookie no-httpOnly con el token. El frontend lee esa cookie y la envía en cada request mutante como header `x-csrf-token`. Un middleware en Express valida que el header coincida con la cookie antes de procesar cualquier `POST/PUT/PATCH/DELETE` en rutas privadas.

**Tech Stack:** `csrf-csrf` (backend), `js-cookie` o lectura manual de cookies (frontend), Express middleware, TypeScript.

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `api/src/middlewares/csrf.middleware.ts` | Crear | Configuración y exportación del middleware `csrf-csrf` |
| `api/src/index.ts` | Modificar | Montar endpoint `/api/csrf-token` y middleware CSRF en rutas privadas |
| `api/src/config/session.config.ts` | Modificar | Agregar `CSRF_COOKIE_NAME` al config centralizado |
| `web/src/auth/csrf.ts` | Crear | Lógica de fetch del token y lectura de cookie CSRF |
| `web/src/auth/authFetch.ts` | Modificar | Adjuntar `x-csrf-token` header en métodos mutantes |
| `api/CHANGELOG.md` | Modificar | Documentar el cambio |
| `web/CHANGELOG.md` | Modificar | Documentar el cambio |

---

## Task 1: Instalar `csrf-csrf`

**Files:**
- Modify: `api/package.json` (via npm)

- [ ] **Step 1: Instalar la dependencia**

```bash
cd api && npm install csrf-csrf
```

- [ ] **Step 2: Verificar instalación**

```bash
cat api/package.json | grep csrf-csrf
```
Expected: `"csrf-csrf": "^X.X.X"`

- [ ] **Step 3: Commit**

```bash
git add api/package.json api/package-lock.json
git commit -m "chore(api): add csrf-csrf dependency"
```

---

## Task 2: Agregar `CSRF_COOKIE_NAME` al config de sesión

**Files:**
- Modify: `api/src/config/session.config.ts`

- [ ] **Step 1: Agregar la constante al SESSION_CONFIG**

En `api/src/config/session.config.ts`, dentro del objeto `SESSION_CONFIG`, agregar después de `REFRESH_TOKEN_COOKIE_NAME`:

```typescript
// CSRF
CSRF_COOKIE_NAME: 'csrf_token',
CSRF_HEADER_NAME: 'x-csrf-token',
```

El bloque `SESSION_CONFIG` queda así al final de las propiedades de token:

```typescript
// Token Names
ACCESS_TOKEN_COOKIE_NAME: 'access_token',
REFRESH_TOKEN_COOKIE_NAME: 'refresh_token',

// CSRF
CSRF_COOKIE_NAME: 'csrf_token',
CSRF_HEADER_NAME: 'x-csrf-token',
```

- [ ] **Step 2: Commit**

```bash
git add api/src/config/session.config.ts
git commit -m "feat(config): add CSRF cookie/header name constants to SESSION_CONFIG"
```

---

## Task 3: Crear el middleware CSRF

**Files:**
- Create: `api/src/middlewares/csrf.middleware.ts`

- [ ] **Step 1: Crear el archivo del middleware**

```typescript
// api/src/middlewares/csrf.middleware.ts
import { doubleCsrf } from 'csrf-csrf';
import { SESSION_CONFIG } from '../config/session.config';
import { IS_PRODUCTION } from 'api/envs';

const CSRF_SECRET = process.env.CSRF_SECRET || 'csrf-dev-secret-change-in-production';

export const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => CSRF_SECRET,
  cookieName: SESSION_CONFIG.CSRF_COOKIE_NAME,
  cookieOptions: {
    httpOnly: false,   // Must be readable by JS on the frontend
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
  },
  getTokenFromRequest: (req) =>
    req.headers[SESSION_CONFIG.CSRF_HEADER_NAME] as string | undefined,
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});
```

- [ ] **Step 2: Verificar que compila sin errores**

```bash
cd api && npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add api/src/middlewares/csrf.middleware.ts
git commit -m "feat(api): add CSRF double-submit cookie middleware"
```

---

## Task 4: Exponer endpoint `/api/csrf-token` y proteger rutas privadas

**Files:**
- Modify: `api/src/index.ts`

- [ ] **Step 1: Importar el middleware y `generateToken` en `index.ts`**

Al inicio de `api/src/index.ts`, después de los imports existentes, agregar:

```typescript
import { generateToken, doubleCsrfProtection } from './middlewares/csrf.middleware';
```

- [ ] **Step 2: Agregar el endpoint de token CSRF (ruta pública)**

En `api/src/index.ts`, después de `app.use(cookieParser());` y antes de los rate limiters, agregar:

```typescript
// ---- CSRF Token Endpoint ----
// Returns a CSRF token and sets the csrf_token cookie (non-httpOnly)
// Must be called by the frontend before any state-mutating request
app.get('/api/csrf-token', (req, res) => {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
});
```

- [ ] **Step 3: Agregar el middleware CSRF a las rutas privadas**

Modificar el bloque de rutas privadas para incluir `doubleCsrfProtection`:

```typescript
app.use(
  '/api/private',
  privateApiRateLimiter,
  express.json({ limit: '5mb' }),
  doubleCsrfProtection,  // <-- agregar aquí
  isAuthenticated,
  router
);
```

- [ ] **Step 4: Actualizar el header CORS para permitir `x-csrf-token`**

En el objeto `corsMiddleware`, modificar `allowedHeaders`:

```typescript
allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
```

- [ ] **Step 5: Actualizar el comentario de CSRF en `index.ts`**

Reemplazar el bloque de comentario existente (líneas 104-109):

```typescript
// CSRF Protection:
// Uses Double Submit Cookie pattern via csrf-csrf.
// - GET /api/csrf-token generates a token and sets a non-httpOnly cookie
// - Frontend reads the cookie and sends it as x-csrf-token header
// - doubleCsrfProtection middleware validates header matches cookie on all mutating routes
// sameSite='lax' still applies as a second layer of defense.
```

- [ ] **Step 6: Verificar que compila**

```bash
cd api && npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 7: Commit**

```bash
git add api/src/index.ts
git commit -m "feat(api): expose /api/csrf-token endpoint and protect private routes with CSRF middleware"
```

---

## Task 5: Agregar variable de entorno `CSRF_SECRET`

**Files:**
- Modify: `api/.env.example` (si existe) o documentar en CHANGELOG

- [ ] **Step 1: Verificar si existe `.env.example`**

```bash
ls api/.env.example 2>/dev/null || echo "no existe"
```

- [ ] **Step 2a: Si existe `.env.example`, agregar la variable**

```bash
echo "CSRF_SECRET=your-random-secret-here" >> api/.env.example
```

- [ ] **Step 2b: Si no existe, solo documentar (ver Task 8 changelog)**

- [ ] **Step 3: Agregar `CSRF_SECRET` a las variables de entorno de producción**

En Vercel (o donde se despliega el API), agregar:
```
CSRF_SECRET=<generado con: openssl rand -base64 48>
```

- [ ] **Step 4: Commit (solo si se modificó .env.example)**

```bash
git add api/.env.example
git commit -m "chore(api): document CSRF_SECRET env var"
```

---

## Task 6: Frontend — crear `csrf.ts` para gestión del token

**Files:**
- Create: `web/src/auth/csrf.ts`

- [ ] **Step 1: Crear el módulo de gestión CSRF**

```typescript
// web/src/auth/csrf.ts

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Reads the CSRF token from the cookie set by the server.
 * The cookie is non-httpOnly, so JS can read it.
 */
function readCsrfCookie(): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

/**
 * Fetches a fresh CSRF token from the server.
 * Call this once at app init and after login.
 */
export async function fetchCsrfToken(): Promise<void> {
  await fetch('/api/csrf-token', { credentials: 'include' });
}

/**
 * Returns the current CSRF token from cookie, or null if not yet fetched.
 */
export function getCsrfToken(): string | null {
  return readCsrfCookie();
}

export { CSRF_HEADER_NAME };
```

- [ ] **Step 2: Commit**

```bash
git add web/src/auth/csrf.ts
git commit -m "feat(web): add CSRF token management module"
```

---

## Task 7: Frontend — enviar token en `authFetch`

**Files:**
- Modify: `web/src/auth/authFetch.ts`

- [ ] **Step 1: Importar y usar el token CSRF en `authFetch`**

```typescript
// src/auth/authFetch.ts
import { queryClient } from '@/pages/App';
import { authKeys } from './auth.keys';
import { getCsrfToken, CSRF_HEADER_NAME } from './csrf';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let logoutFn: null | (() => Promise<void>) = null;
export const bindGlobalLogout = (fn: () => Promise<void>) => (logoutFn = fn);

export async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? 'GET').toUpperCase();
  const csrfHeaders: Record<string, string> = {};

  if (MUTATING_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) {
      csrfHeaders[CSRF_HEADER_NAME] = token;
    }
  }

  const res = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      ...init?.headers,
      ...csrfHeaders,
    },
  });

  if (res.status === 401) {
    await queryClient.setQueryData(authKeys.me(), { data: { user: undefined } });
    if (logoutFn) await logoutFn();
    throw new Error('Not authenticated');
  }
  return res;
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web && npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add web/src/auth/authFetch.ts
git commit -m "feat(web): attach x-csrf-token header on mutating requests in authFetch"
```

---

## Task 8: Frontend — llamar `fetchCsrfToken` al iniciar la app

**Files:**
- Modify: `web/src/providers/` — el AuthProvider o el provider raíz que gestiona el inicio de sesión

- [ ] **Step 1: Localizar el provider de auth**

```bash
grep -r "fetchCsrfToken\|/api/csrf-token\|isAuthenticated\|useAuth" web/src/providers/ --include="*.tsx" -l
```

Buscar el componente que verifica la sesión al iniciar (suele llamar a `/api/private/auth/validate` o similar).

- [ ] **Step 2: Llamar `fetchCsrfToken` después de verificar la sesión**

En el provider que inicializa la sesión, importar y llamar `fetchCsrfToken` cuando el usuario esté autenticado. Ejemplo (ajustar al archivo real):

```typescript
import { fetchCsrfToken } from '@/auth/csrf';

// En el effect/callback que confirma que el usuario está logueado:
useEffect(() => {
  if (user) {
    fetchCsrfToken(); // Obtener token CSRF una vez autenticado
  }
}, [user]);
```

- [ ] **Step 3: Verificar que compila**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/src/providers/
git commit -m "feat(web): fetch CSRF token on auth initialization"
```

---

## Task 9: Smoke test manual

- [ ] **Step 1: Levantar el stack**

```bash
npm run api   # Terminal 1
npm run web   # Terminal 2
```

- [ ] **Step 2: Verificar que el endpoint CSRF responde**

```bash
curl -s http://localhost:3000/api/csrf-token
```
Expected: `{"csrfToken":"..."}` y cookie `csrf_token` en la respuesta

- [ ] **Step 3: Verificar que un POST sin token es rechazado**

```bash
curl -s -X POST http://localhost:3000/api/private/auth/logout \
  -H "Cookie: access_token=<token_valido>" \
  -H "Content-Type: application/json"
```
Expected: `403` o similar (CSRF validation failed)

- [ ] **Step 4: Verificar login + acciones desde el frontend**

1. Abrir `http://localhost:5173`
2. Hacer login — debe funcionar sin errores en consola
3. Realizar una acción que haga POST/PUT/PATCH/DELETE (ej. crear apuesta)
4. Expected: funciona correctamente, sin errores 403

---

## Task 10: Actualizar CHANGELOGs

**Files:**
- Modify: `api/CHANGELOG.md`
- Modify: `web/CHANGELOG.md`

- [ ] **Step 1: Agregar entrada en `api/CHANGELOG.md`**

Agregar bajo `## [Unreleased]`:

```markdown
### Added - 2026-04-09

#### CSRF Protection (Double Submit Cookie)
- **CSRF Middleware**: `api/src/middlewares/csrf.middleware.ts`
  - Usa `csrf-csrf` con el patrón Double Submit Cookie
  - Cookie `csrf_token` (non-httpOnly, legible por JS)
  - Header requerido: `x-csrf-token` en métodos mutantes (POST/PUT/PATCH/DELETE)
- **CSRF Token Endpoint**: `GET /api/csrf-token`
  - Genera token y setea cookie; debe llamarse al iniciar sesión
- **Rutas protegidas**: `doubleCsrfProtection` aplicado a `/api/private/*`
- **ENV requerida**: `CSRF_SECRET` (string aleatorio largo; sin ella usa fallback inseguro en dev)
- **CORS**: `x-csrf-token` agregado a `allowedHeaders`
```

- [ ] **Step 2: Agregar entrada en `web/CHANGELOG.md`**

```markdown
### Added - 2026-04-09

#### CSRF Token Management
- **`web/src/auth/csrf.ts`**: módulo para fetch y lectura del token CSRF desde cookie
  - `fetchCsrfToken()`: llama `GET /api/csrf-token` para obtener/refrescar el token
  - `getCsrfToken()`: lee el token de la cookie `csrf_token`
- **`web/src/auth/authFetch.ts`**: adjunta `x-csrf-token` header automáticamente en POST/PUT/PATCH/DELETE
```

- [ ] **Step 3: Commit**

```bash
git add api/CHANGELOG.md web/CHANGELOG.md
git commit -m "docs: document CSRF protection implementation"
```
