# Auditoría de Performance y Seguridad — QuiniApp

**Fecha:** 2026-06-11
**Alcance:** Backend (api/), Frontend (web/), Base de datos (Supabase), dependencias.
**Contexto:** Usuarios con conexiones pobres (3G/CGNAT) y equipos viejos. Objetivo: fluidez y mínimo consumo de recursos.

> Estado: hallazgos pendientes de implementación, salvo lo marcado como ✅ Hecho.

---

## ✅ Hecho en esta auditoría

- `@vercel/speed-insights` actualizado `^1.2.0` → `^2.0.0` en `web/package.json`.
  - API sin cambios (`<SpeedInsights />` desde `@vercel/speed-insights/react`, export `/react` verificado en v2, compatible React 18).
  - v2 agrega `sampleRate` y `beforeSend` (control de muestreo/costos, no afecta el score).
  - Build de producción verificado sin errores.

---

## 1. Frontend — Hallazgo principal

### 1.1 ~70% del bundle inicial son librerías de PDF sin uso en la carga (CRÍTICO para mobile)

El chunk `vendor` (645 kB / 188 kB gzip) viene **precargado en `index.html`** vía `modulepreload`. Composición real (medida con `dist/stats.html` del visualizer):

| Paquete | Tamaño (pre-minify) | ¿Necesario al inicio? |
|---|---|---|
| html2canvas | 400 kB | No — dep interna de jspdf |
| canvg | 165 kB | No — dep interna de jspdf |
| core-js | 164 kB | No — lo arrastra canvg |
| pako | 104 kB | No — compresión de jspdf |
| dompurify | 60 kB | No — dep de jspdf |
| fast-png, fflate, iobuffer, svg-pathdata, stackblur-canvas, rgbcolor | ~110 kB | No — deps de jspdf/canvg |
| zod, react-hook-form, dnd-kit, query-core, react-hot-toast, cmdk, floating-ui | ~330 kB | Sí |

**Causa:** `manualChunks` en `vite.config.ts:100` solo matchea `id.includes('jspdf')`. Las dependencias transitivas de jspdf no contienen "jspdf" en su path → caen al chunk `vendor` genérico, que es eager.

**Fix** (en `vite.config.ts`, reemplazar el bloque de jspdf):

```ts
// PDF generation (lazy-loaded, separate chunk)
if (
  id.includes('jspdf') ||
  id.includes('html2canvas') ||
  id.includes('canvg') ||
  id.includes('core-js') ||
  id.includes('pako') ||
  id.includes('dompurify') ||
  id.includes('fflate') ||
  id.includes('fast-png') ||
  id.includes('iobuffer') ||
  id.includes('svg-pathdata') ||
  id.includes('stackblur-canvas') ||
  id.includes('rgbcolor')
) {
  return 'pdf-vendor';
}
```

**Impacto estimado:** −~130 kB gzip y −~700 kB de parse/execute en la carga inicial. Mejora directa de LCP, FCP y TBT en equipos de gama baja. Es la mejora #1 para Speed Insights mobile.

### 1.2 Resto frontend

| # | Hallazgo | Detalle / Fix |
|---|---|---|
| 1 | Deps muertas/duplicadas | `@tailwindcss/vite` (v4) en deps pero el build usa Tailwind v3 vía PostCSS → remover. `@vitejs/plugin-react` y `plugin-react-swc` juntos, solo se usa swc → remover el primero. `@types/react`/`@types/react-dom` v19 con React 18 → bajar a v18. |
| 2 | Archivo CSS huérfano | `web/src/index.css` (importa `tw-animate-css`) no lo importa nadie — el real es `src/styles/index.css`. Borrar archivo + dep `tw-animate-css`. |
| 3 | Reloj sincroniza contra `worldtimeapi.org` | `ClockProvider.tsx:98` — servicio externo con rate limits y caídas. Reemplazar por endpoint propio del API (o header `Date` de cualquier respuesta). |
| 4 | Tráfico de fondo de sesión | `validate()` cada 5 min + refresh cada 13 min. El refresh ya prueba que la sesión vive → subir `VALIDATE_INTERVAL_MS` a 10–15 min. En 3G el polling compite con requests reales. |
| 5 | SSE sin consumidor | `session-sse.manager` existe en backend (`/auth/stream`) pero web no tiene ningún `EventSource`. Decidir: usarlo (revocación push, elimina polling) o borrarlo. Ojo: el proxy actual bufferiza respuestas → SSE no funcionaría a través del proxy. |
| 6 | date-fns + dayjs conviven | date-fns (122 kB) lo exige react-day-picker v8; ya queda en chunk lazy `calendar-vendor`. Aceptable. Migrar a react-day-picker v9 lo reduciría. |

**Ya está bien (no tocar):** lazy routes con prefetch por `auth_hint`, providers condicionales, ClockProvider con contexto dividido (`useClockFunctions`), jspdf con `import()` dinámico, terser + `drop_console`, cache immutable en `vercel.json`, sin fuentes web custom, SVGs livianos, QueryClient con `staleTime` 5 min y sin `refetchInterval`.

---

## 2. Backend

| # | Hallazgo | Detalle / Fix |
|---|---|---|
| 1 | **Lectura de `users` en DB en CADA request privado** | `auth.middleware.ts:92` (`getUserById`, `SELECT *`). Session cache existe pero user data no. Fix: cache de usuario con TTL 2–5 min + invalidación al editar usuario, o usar claims del JWT. Ahorra un roundtrip DB por request. Además `SELECT *` trae `password_hash` innecesariamente → seleccionar columnas. |
| 2 | **bcrypt sobre refresh tokens** | Login = 2 `hashPassword` + 1 compare (~600 ms con 12 rounds); refresh = 1+1 (~400 ms cada 13 min/usuario). Cambiar a SHA-256 (ver Seguridad 3.5 — además arregla detección de reuso). Login ~3× más rápido. |
| 3 | Payload inflado en bets | `bet.repository.ts:42` `select('*, lotteries(*), schedules(*)')` embebe lottery y schedule completos repetidos por cada fila (hasta 100). Seleccionar solo columnas necesarias. |
| 4 | `count: 'exact'` en cada página | `ticket.repository.ts:118` y `bet.repository.ts:42` ejecutan COUNT(*) por request. El patrón correcto ya existe en `getAllBetsGrouped` (count solo en page 1) → replicar. |
| 5 | Proxy Vercel = doble salto | `web/api/api-proxy.ts`: cada request paga función serverless intermedia (cold start + hop extra). Evaluar rewrite directo en `vercel.json` (`"destination": "https://<backend>/api/$1"`, corre en edge sin función). Limitación: URL fija por entorno. Alinear región de función Vercel con región del backend. |
| 6 | Deps muertas en API | `lusca`, `express-session`, `pg`, `postgres` — sin un solo import. Remover. |
| 7 | Delete de tickets no atómico | `ticket.repository.ts:149` — dos updates secuenciales con "rollback" manual. Ventana de inconsistencia. Mover a RPC transaccional (como `create_ticket_with_bets`). |
| 8 | Bug latente en getWinnerBets | `bet.repository.ts:244-249` — pasa el query builder **sin await** como valor a `.eq('ticket_id', ticket)`. La ruta con `ticket_number` no funciona como se espera. |

---

## 3. Seguridad

### Prioridad ALTA

1. **Contraseñas en logs** — `error.middleware.ts:27` loguea `body: req.body` completo en cada error. Un login que falle validación Zod escribe la contraseña en texto plano en los logs de Winston. Fix: redactar campos sensibles (`password`, `token`) antes de loguear.

2. **Lockout de cuentas desconectado** — `auth.repository.ts` tiene `incrementFailedAttempts`, `lockAccount`, `locked_until` (con índice y RPC en DB), pero `loginWithSession` (`auth.controller.ts`) nunca los llama ni verifica `locked_until`. La única protección anti fuerza bruta es rate-limit por IP, relajado a propósito por el CGNAT (muchos usuarios comparten IP). Conectar el lockout por cuenta cubre exactamente ese hueco.

3. **Política de contraseñas vacía** — `validatePasswordStrength` (`password.ts:51`) solo exige "no vacía". Combinado con el punto 2, una contraseña de 1 carácter cae en segundos. Mínimo: 8 caracteres.

4. **`express-rate-limit` 8.2.1 vulnerable** — GHSA-46wh-pxpv-q5gq (severidad alta): IPv4-mapped IPv6 bypasea el límite por cliente en dual-stack. `npm audit fix` → 8.5.1+. También con fix disponible: `uuid` (moderada) y `dompurify` (XSS moderada, llega vía jspdf). El resto de las 32 vulnerabilidades del audit son tooling de dev (supabase CLI, patch-package, import-sort-cli, vite dev server).

### Prioridad MEDIA

5. **Detección de reuso de refresh tokens inalcanzable** — bcrypt trunca la entrada a 72 bytes y dos refresh tokens JWT de la misma sesión comparten los primeros ~100+ caracteres (header fijo + inicio del payload con mismo `user_id`/`session_id`). Resultado: `comparePassword(tokenViejo, hashNuevo)` devuelve `true` para cualquier token rotado de esa sesión → la rama "token reuse detected → revocar todas las sesiones" (`auth.controller.ts:234`) nunca se dispara; la protección real queda solo en `token_version`, que trata el mismatch como refresh concurrente benigno, no como ataque. **Fix:** guardar `SHA-256(token)` en vez de bcrypt — restaura la detección real de reuso y elimina ~400 ms de CPU por refresh (perf + seguridad a la vez).

6. **`generateRandomPassword` usa `Math.random()`** — no criptográfico; para resets usar `crypto.randomInt()`.

7. **Faltan security headers** — API sin `helmet` (sin `X-Content-Type-Options`, `X-Frame-Options`, HSTS) y `web/vercel.json` sin CSP ni `X-Frame-Options` para el front. Agregar headers al `vercel.json` y `helmet` al API.

### BAJO / aceptable como está

- CSRF stateless por `X-Requested-With` (válido, depende del preflight CORS bien configurado — lo está).
- Cookies `httpOnly` + `secure` + `sameSite=lax`; CORS con allowlist; secrets vía env con validación `must()`; errores sin stack en producción.
- Multi-tenancy con `organization_id` validado server-side (`resolveGroupFilter` revisado: correcto).
- `express.json` limit 5 MB en privado es generoso; 1 MB alcanzaría.
- **Nota estructural:** el service role key de Supabase bypasea RLS → el filtrado por `organization_id` en repositorios es la única barrera multi-tenant. Hoy bien aplicado, pero cualquier query nueva que lo olvide filtra datos de otra org. Considerar RLS como segunda red de seguridad.

---

## 4. Base de datos

Estado general: **bueno**.

- Índices completos: parciales, compuestos, `organization_id` en todas las tablas, migración dedicada `20260423101500_add_performance_indexes.sql`.
- Sistema de archivado (`bets_archive`/`tickets_archive` + cache de días activos en memoria) sólido.
- SPs con `FOR UPDATE` + advisory locks; idempotencia con `client_request_id`.

Mejoras puntuales = backend #3, #4 y #7 (lado consumidor de la DB).

---

## 5. Speed Insights mobile — plan por impacto

1. **Fix de `manualChunks`** (hallazgo 1.1): −~130 kB gzip y −~700 kB de parse inicial → LCP/FCP/TBT.
2. **TTFB de API**: eliminar doble salto del proxy (backend #5); alinear regiones Vercel/backend.
3. **Menos tráfico de fondo** (frontend 1.2 #4).
4. **Cache de usuario en auth middleware** (backend #1): baja latencia de todos los endpoints privados.
5. Con v2: `sampleRate` disponible si el volumen de eventos genera costo (no afecta el score).
6. Futuro: service worker con precache (Workbox) para revisitas en conexiones pobres — los assets ya son immutable.

---

## Orden de implementación sugerido

1. Fix `manualChunks` (1.1) — mayor impacto, riesgo mínimo.
2. Seguridad ALTA (3.1 a 3.4).
3. Cache de usuario en middleware (backend #1).
4. SHA-256 para refresh tokens (3.5 + backend #2).
5. Limpieza de deps muertas (frontend 1.2 #1-2, backend #6).
6. Resto según prioridad de producto.
