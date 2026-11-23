# Auditoría y actualización de dependencias (OWASP Top 10:2025)

- **Fecha:** 2026-11-23
- **Rama:** `chore/deps-update`, sobre `chore/node-26` (PR #586)
- **Entorno:** Node 26.13.1 / npm 11.20.0
- **Reemplaza a:** el informe del 2026-11-20 (`auditoria-dependencias-2026-11-20.md`, que no se versionó).

## 1. Resumen

| Métrica | Antes | Después |
|---|---|---|
| Vulnerabilidades (`npm audit`, todo el árbol) | **41**: 4 críticas, 18 altas, 17 moderadas, 2 bajas | **0** |
| Vulnerabilidades en producción (`--omit=dev`) | **16**: 2 críticas, 8 altas, 6 moderadas | **0** |
| Paquetes en el lockfile | 1.290 (299 de producción) | 846 (256 de producción) |
| Paquetes con script de instalación | 10 | 5 |
| Dependencias directas desactualizadas | 123, unas 45 con salto mayor | 2, por decisión: Tailwind 4 y TypeScript 7 (ver §6) |

**Qué se hizo:**
- Se actualizó todo a la última versión.
- Hubo saltos mayores en Express, zod, React, react-day-picker, lucide, ESLint, TypeScript (6), jest, dotenv, lint-staged y Supabase CLI.
- Se eliminaron 34 declaraciones de dependencias sin uso o reemplazables.
- Se agregaron controles de supply chain al CI (`npm ci`, gate de audit) y Dependabot.
- `package-lock.json` se regeneró desde cero.

## 2. Metodología

- **Vulnerabilidades:** `npm audit --json` (todo el árbol y `--omit=dev`), cruzado con los CWE de cada advisory.
- **Desactualizados:** `npm outdated --all` por workspace.
- **Uso real de cada dependencia:** búsqueda de imports y requires en código, configuración y scripts de `package.json`, verificada a mano.
- **Impacto de cada salto mayor:** guías oficiales de migración (Context7, docs de cada proyecto, código fuente de los paquetes) y búsqueda en el código de las APIs afectadas.
- **Licencias y scripts de instalación:** campos `license` y `hasInstallScript` de `package-lock.json`.
- **Verificación** (detalle en §7): typecheck, lint, tests, builds y la API corriendo contra Supabase local. Además, un recorrido en navegador (Playwright) de todas las rutas de web y polla-web logueado, el calendario nuevo y el proxy de Vercel contra un backend HTTP/2.

## 3. Hallazgos por categoría OWASP Top 10:2025

| Categoría | Hallazgo | Estado |
|---|---|---|
| **A01 Broken Access Control** | Sin hallazgos de dependencias. El control de acceso es propio: JWT y la matriz de roles en `helper`. | No aplica |
| **A02 Security Misconfiguration** | El CI tenía permisos por defecto. Las configs de lint de web estaban muertas, así que web nunca se lintea. `prepare` no instalaba los hooks. | `permissions: contents: read`. Configs muertas eliminadas. husky 9 se instala en `prepare`. **Pendiente:** web no tiene lint (§6). |
| **A03 Software Supply Chain Failures** | 41 vulnerabilidades conocidas, 123 paquetes desactualizados, 34 dependencias sin uso o reemplazables, 10 paquetes con install scripts, `@vercel/node` (solo para tipos) con `undici` y `path-to-regexp` vulnerables fijados, y sin actualización automática. | Todo actualizado, 0 vulnerabilidades, 444 paquetes menos. `@vercel/node` reemplazado por tipos locales. Dependabot con cooldown. Gate `npm audit` en el CI. |
| **A04 Cryptographic Failures** | `bcrypt` 6.0.0 y `jsonwebtoken` 9.0.3 están al día y sin advisories. `uuid` en la API se usaba para generar ids. | Sin cambios en cripto. `uuid` → `crypto.randomUUID()` nativo (CSPRNG del runtime), un paquete menos. |
| **A05 Injection** | `jspdf` ≤4.2.0: PDF injection con ejecución de JavaScript (CWE-116, **crítica**). `dompurify`: XSS (CWE-79). `react-router` 7.0–7.18.1: XSS y RCE vía turbo-stream (CWE-502, alta). `ip-address`: XSS y SSRF. `form-data`: CRLF injection. | jspdf 4.2.1, dompurify, react-router-dom 7.18.6 e ip-address actualizados. |
| **A06 Insecure Design** | Sin hallazgos de dependencias. | No aplica |
| **A07 Authentication Failures** | `express-rate-limit` 8.0.1–8.5.0: una IPv6 mapeada (`::ffff:a.b.c.d`) esquivaba el rate limit por cliente (CWE-770, alta). `proxy-addr` <2.0.8: IP spoofing con subredes de confianza (CWE-290/348, **crítica**). | express-rate-limit 8.7.5. Express 5.3 con proxy-addr 2.0.8+. |
| **A08 Software or Data Integrity Failures** | El CI y Render instalaban con `npm install`, que no garantiza el lockfile. Las actions no están fijadas por SHA. `qs`/`flatted`/`yargs-parser`: prototype pollution. | El CI usa `npm ci`. Prototype pollution resuelto. **Pendiente:** fijar las actions por SHA (Dependabot las mantiene) y `npm ci` en Render. |
| **A09 Security Logging & Alerting Failures** | `morgan` ≤1.12.0: log forging con caracteres de control o separadores Unicode (CWE-117). | morgan 1.12.1. La API ya sanitiza lo que loguea (`sanitize-log`). |
| **A10 Mishandling of Exceptional Conditions** | DoS por entradas malformadas en `body-parser`, `qs`, `path-to-regexp` (ReDoS), `ws`, `zod` (memoria), `fflate`, `brace-expansion`, `minimatch`, `picomatch`, `js-yaml` y `tar`. Además, un JSON mal formado o un cuerpo demasiado grande devolvían **500** en vez de 400/413, y en desarrollo con el stack. | Todo actualizado. `error.middleware.ts` responde 400/413/415 a los errores del parser. |

## 4. Vulnerabilidades corregidas (producción)

| Paquete | Severidad | Problema (CWE) | Arreglo |
|---|---|---|---|
| `jspdf` ≤4.2.0 | Crítica | PDF injection → JavaScript arbitrario (CWE-116); DoS por BMP (CWE-400) | 4.2.1 |
| `proxy-addr` <2.0.8 | Crítica | IP spoofing con IPv4 mapeada a IPv6 (CWE-290/348) | Express 5.3 |
| `body-parser` ≤1.20.8 | Alta | DoS: el límite de tamaño se desactivaba en silencio (CWE-770) | Express 5.3 (body-parser 2.4) |
| `express-rate-limit` 8.0.1–8.5.0 | Alta | Bypass del rate limit por cliente (CWE-770) | 8.7.5 |
| `ip-address` ≤10.7.3 | Alta | XSS en métodos HTML (CWE-79); SSRF por octetos con cero inicial (CWE-20) | actualizado |
| `path-to-regexp` | Alta | ReDoS (CWE-1333) | Express 5.3 (8.4.2) |
| `react-router` / `react-router-dom` | Alta | RCE vía turbo-stream (CWE-502), XSS en redirects RSC | 7.18.6 |
| `ws` 8.0–8.20.1 | Alta | Lectura de memoria sin inicializar (CWE-908), DoS por fragmentos (CWE-400) | actualizado |
| `zod` <4.6.6 | Alta | Agotamiento de memoria con colecciones grandes (CWE-770) | 4.6.7 (major) |
| `dompurify` ≤3.4.16 | Moderada | XSS (CWE-79) | actualizado |
| `qs` ≤6.16.0 | Moderada | DoS por `arrayLimit` (CWE-20) | actualizado |
| `fflate` 0.8.0–0.8.2 | Moderada | Loop infinito con ZIP64 malformado (CWE-400) | 0.8.3 |
| `morgan` ≤1.12.0 | Moderada | Log forging (CWE-117) | 1.12.1 |
| `uuid` <11.1.1 | Moderada | Sin chequeo de límites del buffer (CWE-787) | eliminado (`crypto.randomUUID`) |

En desarrollo se corrigieron, entre otros:
- `handlebars` (crítica, inyección de JS) y `tar` (crítica, path traversal), que llegaban vía jest 29 y la CLI de Supabase.
- `form-data` (CRLF injection), `tmp` (path traversal) y `flatted`/`yargs-parser` (prototype pollution).
- `esbuild` ≤0.24 (el servidor de desarrollo aceptaba requests de cualquier sitio) y `ajv`, `js-yaml`, `minimatch`, `picomatch`, `glob` y `brace-expansion` (DoS/ReDoS).

## 5. Cambios de código que trajeron los saltos mayores

### API
- **Express 5:**
  - Se sacó `app.options('*')`, que ahora hace caer el arranque.
  - `ensureBody` después de cada `express.json()`, porque `req.body` llega `undefined` sin cuerpo JSON.
  - El callback de `listen` corta el proceso ante EADDRINUSE.
  - El query parser `simple` no afecta: no hay parámetros anidados.
  - `@types/express-serve-static-core` queda fijo en 5.0.6, porque la 5.1 tipa `req.params` como `string | string[]`.
- **zod 4:**
  - `err.errors` → `err.issues` en el middleware de errores. Sin este cambio, todo error de validación pasaba a ser un 500.
- **supabase-js 2.119:**
  - `insert<IUserEntityBack>()` con tipo explícito para la unión de tipos de usuario.
- **dotenv 18:**
  - Los scripts de test usan `dotenv-cli`, porque dotenv 18 trae un binario `dotenv` que choca con el de dotenv-cli.
- **TypeScript 6:**
  - `moduleResolution: "bundler"` y sin `baseUrl`.
  - La API declara `paths` para `src/*` y `envs`.
- **ESLint 10:**
  - `{ cause }` en los errores re-lanzados.
- **Supabase CLI 3:**
  - En `config.toml`, `[inbucket]` → `[local_smtp]` y `enable_signup` → `enabled`.
  - Los comandos de base van al stack local por defecto. Para una base hosteada: `--remote=<url> --yes`.

### helper
- **zod 4:**
  - `z.string().uuid()` → `z.guid()` en 37 campos. Acepta exactamente lo mismo que en zod 3; el `.uuid()` de zod 4 exige RFC 9562.
  - `required_error`/`invalid_type_error` → `error`.
  - `z.record(enum)` → `z.partialRecord`.

### web y polla-web
- **React 19:**
  - Una sola copia en el monorepo.
  - `fetchPriority` en el logo de web.
- **react-day-picker 10 (web):**
  - Calendario reescrito (claves de `classNames`, `Chevron`, `endMonth`/`disabled`/`autoFocus`, locale `react-day-picker/locale`).
  - La excepción CSS pasa de `.rdp` a `.rdp-root`.
- **TanStack Query 5.108:**
  - Los wrappers de mutaciones reenvían el 4º argumento (`context`).
- **zod 4 (polla-web):**
  - `.errors` → `.issues` en 11 formularios.
- **`@vercel/node` eliminado:**
  - Tipos `VercelRequest`/`VercelResponse` locales en `api/api-proxy.ts`.
- **ESLint 10 + react-hooks 7 (polla-web):**
  - Las reglas del React Compiler quedan como warning.

## 6. Pendientes y decisiones

| Tema | Detalle | Recomendación |
|---|---|---|
| **Tailwind 3.4 → 4** | En v4 todo el CSS va en `@layer`. En iOS <15.4, Chrome <99 y Samsung Internet <18 la app se vería sin estilos. Además, unas 60 clases que hoy no hacen nada se activan, y la regla global de tablas con `!important` rompe el padding de las celdas. | **PR aparte**, decidido con el usuario: antes mirar en Vercel Analytics qué navegadores se usan, y migrar con comparación visual antes/después. Hoy queda en 3.4.19 (última 3.x, sin vulnerabilidades). Dependabot ignora el major. |
| **TypeScript 7** | Es el compilador nativo y no expone la API de JS. typescript-eslint pide `<6.1` y ts-jest `<7`. | Queda en 6.0.3. Revisar cuando typescript-eslint lo soporte. Dependabot ignora el major. |
| **jest en la API** | No tiene `jest.config` (se borró en el commit 3b9bd38 y el `.gitignore` de `api/**/*.js` lo oculta), no hay `.env.test` y el CI no lo corre. Se subió a jest 30 con `overrides` de `glob`/`minimatch` porque jest todavía no publicó la corrección. | Portar el único test de integración a `node:test` (como `keyset.test.ts`) y eliminar jest, ts-jest, `@types/jest`, dotenv-cli y cross-env. |
| **web sin lint** | No tiene `eslint.config.js`. Las configs viejas no se leían, así que el código de web nunca se lintea. | Crear `web/eslint.config.js` basado en el de polla-web. Se estiman entre 25 y 35 avisos de react-hooks 7. |
| **react-hooks 7 en polla-web** | `set-state-in-effect` marca 13 casos en 9 archivos (setState sincrónico dentro de efectos). | Revisarlos de a poco y después volver a poner las reglas del Compiler como error. |
| **Mensajes de zod** | En los campos sin mensaje propio el mensaje por defecto cambió y sigue en inglés ("Required" → "Invalid input: expected string, received undefined"). | Opcional: `z.config(z.locales.es())` en cada punto de entrada (API y las dos apps). |
| **Actions por SHA** | `actions/checkout` y `actions/setup-node` están en `@v4`; la última es v7. | Dependabot (`github-actions`) va a proponer v7. Fijarlas por SHA al aceptarlo. |
| **Render** | `render.yaml` usa `buildCommand: npm install`. | Pasar a `npm ci`. |
| **Install scripts** | npm 11 avisa de scripts sin aprobar en `allowScripts` (bcrypt, esbuild, core-js, @parcel/watcher, fsevents) pero todavía los corre. npm 12 los va a bloquear por defecto. | Aprobar en `allowScripts` solo bcrypt y esbuild antes de pasar a npm 12. |
| **Alertas de seguridad** | Las alertas y PRs de seguridad de Dependabot se activan en el repo, no en el archivo. | Activarlas en Settings → Code security. |
| **Supabase local** | El stack local corre Postgres 15 y `config.toml` pide 17 (cambiado el 2026-04-05). Con la CLI 3 se levantó en 15 sin perder datos. | Alinear el local con prod (17) con un dump/restore. Ver `api/supabase/tests/README.md`. |

## 7. Verificación realizada (Node 26.13.1)

- **Instalación:** `npm ci` desde cero. `npm ls --all` sin paquetes inválidos ni faltantes. `npm audit` y `npm audit --omit=dev` dan 0.
- **API:** `tsc --noEmit`, ESLint (0 errores) y `npm run build` (el paso del CI).
  - Corriendo contra Supabase local: login de Polla con bcrypt, preflight CORS 204, validación zod 400, JSON inválido 400, cuerpo grande 413, 404, logout sin body 200 y segunda instancia en el mismo puerto con exit 1.
- **Base:** `supabase test db` con la CLI 3: 28 archivos y 513 tests pgTAP.
- **polla-web:** typecheck, ESLint (0 errores), 246 tests de Vitest y `vite build`.
- **web:** 11 tests de Vitest y `vite build`. `tsc` da los mismos errores que antes (44; ninguno nuevo).
- **Navegador (Playwright, builds de producción con `vite preview`):** 14 rutas de polla-web y 15 de web logueado, sin errores de consola.
  - Calendario de web en 320 px y en desktop: celdas de 36/32 px, sin padding global, días futuros deshabilitados, etiquetas en español y la selección de fecha.
- **Proxy de Vercel (`api-proxy.ts`):** contra un backend HTTP/2 y contra la API local, con status, cookies, varios `Set-Cookie` y body de POST.

## 8. Despliegue

- **Orden:** no hace falta uno especial. La API acepta lo mismo que antes y los frontends no leen `details` de los errores de validación.
- **Railway, Render y Vercel:** ya corren Node 26 (PR #586). Esta rama va encima de ese PR.
- **Supabase CLI 3:** es solo de desarrollo y no se usa en los deploys. Para migrar develop o prod: `npx supabase db push --remote='<URI>' --yes`.

Referencia: [OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction), [A03:2025 Software Supply Chain Failures](https://owasp.org/Top10/2025/A03_2025-Software_Supply_Chain_Failures/).
