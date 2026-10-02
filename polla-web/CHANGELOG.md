# Changelog

All notable changes to the Polla Web workspace are documented in this file.

## [Unreleased]

### Added - 2026-09-28 (Frontend propio de la Polla)

#### Workspace nuevo `polla-web/`
App Vite + React independiente para el sistema de Polla, con su propio deploy. Comparte `helper/` con el resto del monorepo y pega contra el mismo backend, bajo `/api/polla`.

- **Infraestructura**: `vite.config.ts` (puerto 5174 para poder levantar QuiniApp y Polla a la vez, proxy `/api` → `localhost:3000`, alias `@` y `@helper`), `tailwind.config.ts` y `postcss.config.js` copiados de `web/` para mantener el mismo diseño, `vercel.json` + `api/api-proxy.ts` con el mismo patrón same-origin y failover (`POLLA_API_BASE_URL` / `POLLA_API_BASE_URL_BACKUP`, con fallback a las de QuiniApp).
- **Auth**: `AuthProvider` propio contra `/api/polla/auth` (cookies `polla_access_token`/`polla_refresh_token`), con revalidación periódica, refresh preventivo y manejo del evento `AUTH_EXPIRED` del `apiClient`. `ProtectedRoute` obliga a cambiar la contraseña temporal antes de usar la app.
- **`RoleRoute`**: el gateo de rol se hace también a nivel de ruta, no solo de menú — en QuiniApp cualquiera puede entrar por URL a una pantalla que el menú le esconde.
- **`src/routes/backend-routes.ts`** vive dentro de `src/`, alcanzable por el alias `@/`; en QuiniApp el archivo equivalente está fuera de `src/` y se importa con rutas relativas de cuatro niveles desde decenas de archivos.
- **Pantallas**:
  - `features/bets`: feed de jugadas de la edición con aciertos marcados número por número, buscador por ticket, filtro por pasador (ADMIN+), impresión del ticket, edición y baja de jugadas, y el panel de ganadores de la edición.
  - `features/my-bets`: vista del jugador con sus jugadas y su historial de créditos.
  - `features/make-bet`: carga de jugada con las 10 cajas de 2 cifras y salto automático; el jugador ve su saldo, ADMIN+ puede cargar a nombre de otro.
  - `features/editions`, `features/results` (carga de los 20 números + botón "Procesar aciertos"), `features/users` (ABM + carga/retiro de créditos con historial), `features/catalogs` (quinielas, turnos y grupos), `features/organizations` (OWNER) y `features/current-account` (pases, premios, comisión, arrastre y liquidación del día).
- **Componentes compartidos**: `PollaNumberBoxes` (movido desde `web/`), `BetNumbers`, `InfiniteList`, `PageHeader`/`EmptyState` y el kit shadcn que se usa.
- **Scroll infinito**: los endpoints son paginados y la UI acumula páginas con `useInfiniteQuery`, igual que QuiniApp. El feed de jugadas usa el cursor keyset (`next_cursor`) en vez de `page`: con offset, una jugada nueva cargada mientras alguien scrollea corre las filas y se repiten o se saltean. El centinela de `InfiniteList` dispara la página siguiente 300px antes del final.
- **Mobile (mínimo 320x480)**: el título de cada sección viaja en el `handle` de la ruta y lo pinta el header, así ninguna pantalla lo repite; el menú se abre encima con backdrop en vez de empujar el contenido; el feed de jugadas se muestra como tarjetas y recién desde `sm` como tabla; los anchos fijos de filtros pasan a `w-full sm:w-[…]`; el panel de los `Select` se limita al ancho disponible y las opciones largas envuelven (antes estiraban el panel y aparecía scroll horizontal).
- **`functions/makePollaTicket.ts`** (movido desde `web/`) y `functions/printPdf.ts`: ticket térmico de 58 mm con los 10 números en 2 columnas x 5 filas; imprime en desktop y comparte en mobile.
- **Data layer**: `useApiQuery`/`useApiMutation` sobre TanStack Query con `keepPreviousData` en las listas filtradas, `staleTime` alto en catálogos y debounce en el buscador de tickets.
