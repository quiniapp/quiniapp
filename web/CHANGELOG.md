# Changelog

All notable changes to the Web workspace are documented in this file.

## [Unreleased]

### Changed - 2026-11-23 (Speed Insights por variable de entorno)

- **Vercel Speed Insights** (`pages/App.tsx`): `<SpeedInsights />` ahora se monta solo si el build corre con **`ENABLE_SPEED_INSIGHTS=true`**. Antes se montaba siempre: en los previews (que gastan cuota y mezclan sus datos con los de producción) y en local (donde cargaba el script de debug desde el CDN de Vercel).
  - `vite.config.ts` lee la variable de `process.env` (no de los `.env`) y la expone como la constante `__ENABLE_SPEED_INSIGHTS__`, declarada en `src/vite-env.d.ts`. Sin la variable, el paquete queda fuera del bundle.
  - En Vercel, cargarla solo en el entorno **Production** y redeployar.
  - No hay que activar nada en el dashboard de Vercel: el plan gratis de Speed Insights (Hobby, Pro y Enterprise) junta datos apenas el deploy incluye el paquete, y cada deploy sirve `/_vercel/speed-insights/*` solo. El "Enable" del proyecto (o `vercel project speed-insights enable`) pasa a Speed Insights Plus, que es pago y requiere plan Pro.

### Changed - 2026-11-23 (actualización de dependencias y OWASP Top 10)

Informe completo en `docs/auditoria-dependencias-2026-11-23.md`. `npm audit` queda en 0.

- **React 18.3 → 19.3.1** (`react`, `react-dom`). Una sola copia en el monorepo. `components/logo`: `fetchpriority` → `fetchPriority`.
- **react-day-picker 8 → 10** en `components/ui/calendar.tsx`, que se reescribió.
  - Claves nuevas de `classNames`: `month_caption`, `month_grid`, `weekday`, `week`, `day_button`, y los modificadores `selected`/`today`/`outside`/`disabled`, que ahora van en el `<td>`.
  - Un único componente `Chevron` reemplaza `IconLeft`/`IconRight`.
  - La raíz conserva la clase `rdp-root`.
  - `SelectDayToSearch`: `toDate` → `endMonth` + `disabled={{ after }}`, `initialFocus` → `autoFocus`, y el locale `es` sale de `react-day-picker/locale` (incluye las etiquetas accesibles en español).
  - `styles/index.css`: la excepción a los estilos globales de tablas pasa de `.rdp` a `.rdp-root`.
  - Verificado en el navegador: celdas de 36 px en mobile, sin padding ni rayado, días futuros deshabilitados.
- **jspdf 4.0 → 4.2.1**: cierra PDF injection (crítica) y DoS. **react-router-dom 7.12 → 7.18.6** (alta). fflate 0.8.3.
- **zod 4.6.7** y **@hookform/resolvers 7.0.8**. El único uso, el login, no cambia.
- **TanStack Query 5.108**: los callbacks de mutación reciben un 4º argumento (`context`). Los hooks que reenvían `onSuccess`/`onError` (`hooks/mutations/lottery/*`, `schedule/*`, `schedule-lottery/*`) lo pasan.
- **lucide-react 0.486 → 1.78** (ningún ícono usado cambió de nombre), **@vercel/analytics 2**, Radix, react-hook-form 7.92, tailwind-merge 3.7 y el resto en su última versión. **Tailwind queda en 3.4.19**: la migración a 4 va en un PR aparte.
- **`api/api-proxy.ts`**: se saca `@vercel/node`, que solo aportaba los tipos `VercelRequest`/`VercelResponse` y en su última versión fija `undici` y `path-to-regexp` vulnerables. Los dos tipos se declaran en el archivo. El body es `Buffer<ArrayBuffer>`, porque con `@types/node` 26 un `Buffer` genérico no entra en `fetch`.
- **Eliminadas por no usarse:** `zustand`, `vaul` (con `components/ui/drawer.tsx`, que no se importaba), `date-fns` (llega por react-day-picker), `postcss-import`, `postcss-nested`, `is-ci`, `patch-package` (y el `postinstall`), `postinstall-postinstall`, `@types/react-router-dom` (v5), `import-sort-*`, `eslint-plugin-import` y `eslint-import-resolver-typescript`.
- **Tooling muerto eliminado:** `.eslintrc.cjs` y `__eslint.config.js` (ESLint no los leía), `.importsortrc`, `.lintstagedrc`, la clave `lint-staged`, husky 8 con su `prepare` y `.husky/`. Los hooks del repo los instala husky 9 desde la raíz.
- TypeScript 6.0.3: sin `baseUrl` en `tsconfig.json` y `tsconfig.app.json`. ESLint 10, react-hooks 7, react-refresh 0.5, globals 17 y vitest 5.1.1.
- Verificado: los 11 tests, `vite build`, y en el navegador las 15 rutas logueado sin errores, más el calendario.

### Changed - 2026-11-23 (Node 26 en Vercel)

- **`engines.node: "26.x"`** en `web/package.json`. El proyecto de Vercel tiene la raíz en `web/` y no lee el `engines` del `package.json` raíz: hasta ahora la versión salía de la configuración del dashboard. `engines` la pisa, así que el build y la función `api/api-proxy.ts` corren en Node 26, igual que la API (Railway/Render) y CI.
- **`@types/node`** `^22.18.8` → `^26.6.6`.
- **`api/api-proxy.ts` no cambia**, pero en Node 26 `fetch` negocia HTTP/2 con los backends que lo soportan. Se probó en local con Node 26.13.1 contra un backend HTTPS con HTTP/2 (status, cookies, varios `Set-Cookie`, body del POST) y contra la API local. Si el proxy fallara con HTTP/2, la variable de entorno `VERCEL_FETCH_DISABLE_H2=1` en Vercel lo vuelve a HTTP/1.1.
- Verificado con Node 26.13.1: `vite build` y los 11 tests.

### Added - 2026-11-22 (ojito para ver la contraseña)

- **`components/ui/password-input.tsx`** (nuevo): `PasswordInput`, un input de contraseña con un botón de ojo para mostrar u ocultar lo escrito. Es el mismo componente que ya usa la Polla.
  - Arranca oculta, y cada campo se muestra por separado.
  - El botón tiene `aria-label` ("Mostrar contraseña" / "Ocultar contraseña") y `aria-pressed`.
  - El foco (y el teclado en el celular) se queda en el input al tocarlo.
  - Se deshabilita junto con el input y pasa el `ref`, así anda con react-hook-form.
- Lo usan todos los inputs que eran `type="password"`: el login (`features/login`), la contraseña del super admin al crear una organización (`features/organizations`) y los dos campos de `ResetPasswordModal` y de `ResetSuperAdminPasswordModal`.
- Sin cambios: la contraseña al crear o editar un usuario (`UserForm`, `user-list-form`) ya era `type="text"` y se sigue viendo siempre.

### Added - 2026-11-22 (tests propios con Vitest)

- **Web tiene sus propios tests**: `npm run test --workspace web` (`vitest run`; `test:watch` para el modo watch). Antes los tests de QuiniApp vivían en polla-web e importaban `../../../../web/src/...`. Ahora cada app tiene los suyos.
  - **`vitest.config.ts`** (nuevo): igual que el de polla-web. Toma `vite.config.ts` (alias `@` y `@helper`) y corre `src/**/*.test.ts` en entorno `node`.
  - **`vitest`** `5.0.5` en devDependencies, la misma versión exacta que polla-web (queda una sola copia en la raíz).
  - Se pasaron de `polla-web/src/__tests__/helper/quiniela-*.test.ts` a `src/__tests__/`: `liquidation-zip.test.ts`, `liquidation-slip.test.ts` y `cashier-pick.test.ts` (11 tests), que ahora importan con `@/lib/...`. Las entradas de abajo nombran las rutas viejas.
  - **CI** (`.github/workflows/ci.yml`): nuevo paso "Test web".

### Changed - 2026-11-22 (Exportar liquidación: elegir los pasadores)

- **Exportar liquidación abre un modal para elegir los pasadores**, igual que en la Polla (`CashierPickDialog`). Vienen tildados los que tuvieron movimiento; los que tienen la hoja toda en 0 aparecen sin tildar, con "Sin movimiento", y se pueden sumar a mano. Reemplaza al filtro fijo de la entrada de abajo, que los dejaba afuera sin opción.
  - **`features/current-account/dialogs/ExportLiquidationsDialog.tsx`** (nuevo): lista con casillas (`{número} · {nombre}` y el Debe/Cobra), "Seleccionar todos (N de M)" y filtro por grupo ("Todos los grupos", cada grupo y "Sin grupo"). Con un filtro se exportan solo los tildados que se ven, y avisa cuántos tildados de otros grupos no entran. El botón dice cuántos PDFs salen ("Exportar 3 PDFs") y se deshabilita sin ninguno.
  - **`lib/cashierPick.ts`** (nuevo): `filterByGroup`, `pickedVisible` y `NO_GROUP`, los helpers de la Polla. Un `group_id` que no es un grupo de la lista (la organización) cuenta como "Sin grupo", igual que en el ZIP.
  - **`lib/liquidationSlip.ts`**: `hasLiquidationAmounts` pasa a llamarse `hasAccountMovement` (mismo criterio: algún monto de la hoja distinto de 0), como en la Polla.
  - **`handlers/exportLiquidacion.ts`**: `loadLiquidationAccounts` trae las cuentas para el modal ("No hay cuentas a liquidar." si no hay ninguna). `exportLiquidacion` arma el ZIP con las cuentas elegidas y devuelve si se entregó. El modal se cierra solo si se entregó; si se cancela el compartir, queda abierto.
  - **Fix:** en el celular, si Safari rechaza el compartir porque armar el ZIP tardó (`blocked`), el ZIP se descarga, como en la Polla. Antes no pasaba nada y el toast igual decía "Liquidaciones exportadas.".
- Tests: `src/__tests__/cashier-pick.test.ts` (nuevo) y `src/__tests__/liquidation-slip.test.ts`. Probado en el navegador con datos de prueba: vienen tildados solo los que tienen movimiento, y funcionan el filtro por grupo, "Seleccionar todos" y la selección que se exporta.

### Changed - 2026-11-22 (liquidaciones en 0 fuera del ZIP)

- **Exportar liquidación** (`features/current-account/handlers/exportLiquidacion.ts`): los pasadores con la hoja toda en 0 no se exportan, así el ZIP trae solo las liquidaciones con algo que cobrar o pagar. Si todos están en 0, avisa "No hay cuentas a liquidar." y no arma un ZIP vacío. Tampoco se piden sus aciertos.
  - **`lib/liquidationSlip.ts`** (nuevo): `hasLiquidationAmounts(account)`, false cuando los 12 montos que imprime la hoja (Pase, Aciertos, Reclamos, Subtotal, Saldo, Cobre, Pague, Deje, Comisión, Deja, Gastos y Debe/Cobra) son 0. Mismo criterio que la Polla, que deja sin tildar a los pasadores sin movimiento.
  - Sin cambios: el PDF suelto de la vista del pasador se sigue bajando aunque esté en 0.
- Tests: `polla-web/src/__tests__/helper/quiniela-liquidation-slip.test.ts`.

### Changed - 2026-11-21 (prefijo del juego en los PDFs de liquidación)

- **Los PDFs de liquidación llevan el prefijo `quiniela_`**, igual que el ZIP; el resto del nombre no cambia. Por qué: al abrir el ZIP o mandar un PDF suelto no se distinguía si era de Quiniela o de Polla.
  - Adentro del ZIP de "Exportar liquidación": `quiniela_6 Laura 15-11-2026.pdf` (antes `6 Laura 15-11-2026.pdf`), `quinielaLiquidationPdfName` en `lib/liquidationZip.ts`.
  - PDF suelto de un pasador (`printUserSlipPDF`, `functions/printLiquidationCashier.ts`): `quiniela_Exportar_Liquidacion_15-11-2026_Laura-6.pdf`.
  - El prefijo sale de una constante, `LIQUIDATION_GAME_PREFIX` (`lib/liquidationZip.ts`), que usan el ZIP y los dos PDFs.
- Tests: `polla-web/src/__tests__/helper/quiniela-liquidation-zip.test.ts`.

### Changed - 2026-11-21 (Vite 6 → Vite 8)

- **Vite 8** (`vite` `>=6.4.1` → `^8.3.8`): el build usa Rolldown + Oxc en lugar de Rollup + esbuild. El build de producción baja de 31 s a 10 s y se cierran las vulnerabilidades del dev server de Vite 6 (lectura de archivos, `launch-editor` en Windows). El rango deja de ser `>=` sin techo. Requiere Node 20.19+ o 22.12+, también en Vercel.
- **`@vitejs/plugin-react` v6** reemplaza a `@vitejs/plugin-react-swc`: en Vite 8 las transformaciones las hace Oxc y el plugin de SWC solo sirve con plugins de SWC. Se quita el `@vitejs/plugin-react` v4 que no se usaba.
- **`rollup-plugin-visualizer`** 6 → 7 (soporta Rolldown).
- Se quita **`@tailwindcss/vite`** (v4, sin uso: Tailwind 3 corre por PostCSS) porque su peer `vite ^5 || ^6` impedía instalar Vite 8.
- **`vite.config.ts`**:
  - `build.rollupOptions` → `build.rolldownOptions` y `manualChunks` → `codeSplitting.groups`: un grupo para las dependencias (`vendorChunkName`, prioridad 2, `includeDependenciesRecursively: false`) y otro para los features (`featureChunkName`, prioridad 1). Con un solo grupo, Rolldown metía react-dom, el router y Radix dentro de `feature-make-plays` (66 → 464 KB). Así los chunks quedan como en Vite 6.
  - `strictExecutionOrder: true`: hay chunks que se importan en ciclo (`vendor` ↔ `react-dom-vendor` ↔ `radix-vendor`, ya en Vite 6). Rollup lo toleraba; con Rolldown la página quedaba en blanco (`require_react_dom is not a function`). Costo: +27 KB gzip en total (565 → 592 KB).
  - `assetFileNames` usa `assetInfo.names[0]` (`name` está deprecado en Rolldown) y los alias usan `import.meta.dirname` en vez de `__dirname`.
  - El CSS ahora lo minifica Lightning CSS (default de Vite 8): `index.css` pasa de 70,6 a 75,1 KB sin comprimir. El entry pasa a llamarse `web-[hash].js` y lo carga un `index-[hash].js` de 42 bytes. Las rutas de caché de `vercel.json` (`/js/`, `/css/`) no cambian.
- Verificado: build, `preview` y dev; login y las 15 rutas sin errores; Exportar Diario genera el mismo PDF (19.544 bytes) que con Vite 6.

### Changed - 2026-11-17 (liquidaciones en ZIP y nombre del parte diario)

- **Exportar liquidación** (`features/current-account/handlers/exportLiquidacion.ts`): baja un ZIP en lugar de un PDF por pasador.
  - El ZIP y su carpeta raíz se llaman `quiniela_liquidaciones_DD-MM-YYYY`.
  - Adentro va una carpeta por grupo, `Leo DD-MM-YYYY/6 Laura DD-MM-YYYY.pdf`, y `Sin grupo DD-MM-YYYY/` para los demás. Los grupos son sub-organizaciones sin número: la carpeta lleva solo el nombre. Si ningún pasador tiene grupo, los PDF van en la raíz.
  - En el celular abre el menú de compartir; en la computadora se descarga.
  - Los grupos salen de `useGroups`, que ahora usa la página (`features/current-account/index.tsx`).
- **`web/src/lib/liquidationZip.ts`** (nuevo): nombres, rutas (con `@helper/functions/liquidationZip`) y `zipFiles` con **fflate** (dependencia nueva, ^0.8.2, la misma de polla-web, cargada con `import()`).
- **`printLiquidationCashier.ts`**: `buildUserSlipPDF` arma la hoja y la devuelve; `printUserSlipPDF` la sigue bajando suelta en la vista del pasador, con el mismo nombre.
- **Exportar diario** (`functions/exportDiarioPDF.ts`): el archivo pasa a llamarse `Quiniela parte diario DD-MM-YYYY` y el título del PDF, "Parte diario".
- Sin cambios: Exportar diario y Exportar liquidación siguen sin aplicar el filtro de grupo de la página (`handlers/shared.ts`).

### Changed - 2026-11-16 (rendimiento SQL — Fase 1: keyset en jugadas y tickets)

**Qué cambia.** Los listados de jugadas (modo lista) y de tickets paginan con cursor (`next_cursor`), siguiendo el cambio de la API. Se arreglan los totales que hoy salían mal por la paginación.

#### Hooks
- **`useInfiniteBets`**:
  - En modo lista, `pageParam` es el cursor (`''` en la primera página). El modo agrupado sigue con número de página.
  - `nextBetsPageParam` resuelve el siguiente según el modo.
  - El `limit` por defecto es el mismo en la query key y en el fetch: antes eran 100 y 150.
- **`useInfiniteBetsByTicketNumber`** y **`useInfiniteTickets`**: cursor. `fetchTicketsPage` queda exportado.
- **`web/src/lib/fetchAllPages.ts`** (nuevo): recorre un listado keyset hasta el final, de a 900 filas.

#### Fixes
- **`useBets`** / **`useTickets`** (cuenta corriente, "Aciertos / Tickets a liquidar" y PDF de liquidación): traen todas las páginas con `fetchAllPages`. Antes se cortaban en las primeras 100 filas.
- **"Cantidad de Tickets"** (`table-terminal-ticket.tsx`): muestra `pages[0].pagination.totalCount`, el total del filtro. Antes contaba solo los tickets ya cargados en el scroll.
- **Imprimir jugadas** (`print-grouped-bets-button.tsx`): en modo lista recorre con cursor, así que no repite filas si entran jugadas mientras imprime. El modo agrupado sigue por página.

#### Removed
- `web/src/hooks/fetchs/plays/useTotals.ts`: no tenía consumidores y dependía de `FetchBetsProps.grouped`, que se quitó. `useBets` es solo modo lista.

### Added - 2026-10-05 (Compartir ticket como imagen)

#### El cajero elige cómo compartir el comprobante: imagen, PDF o imprimir
Antes, al crear un ticket (y en "Reimprimir"), el celular compartía siempre el PDF y la compu lo mandaba directo a imprimir. Un PDF en WhatsApp se ve como un ícono con el nombre del archivo, sin vista previa confiable, y no hay forma de controlar esa miniatura desde la app. Una imagen, en cambio, se ve completa en el chat.

- **`src/components/modals/ShareTicketModal.tsx`** (nuevo): se abre al crear un ticket como cajero y al tocar "Reimprimir".
  - En celular ofrece **Imagen** (opción principal) y **PDF**, y ambas abren la hoja de compartir del sistema. No ofrece "Imprimir" porque Android no puede imprimir un PDF desde un iframe; el PDF se imprime compartiéndolo a la app de la impresora, como hasta ahora.
  - En la compu ofrece **Imprimir** (opción principal, con el foco puesto: Enter imprime), **Imagen** y **PDF**. Las dos últimas descargan el archivo.
  - Genera el PNG y el PDF apenas se abre el modal. Así el share sale en el mismo toque, porque Safari lo rechaza (`NotAllowedError`) si en el medio hay una espera. Si igual lo rechaza, pide tocar de nuevo. Si el usuario cancela la hoja de compartir, el modal queda abierto.
- **`src/functions/makeTicketImage.ts`** (nuevo): `makeTicketImages` dibuja el ticket con Canvas 2D, sin dependencias nuevas. Tiene el mismo contenido que el PDF térmico: blanco y negro, filas en monoespaciado y separadores punteados. Usa escala 2x para que se vea nítido. Los tickets largos se parten en varias imágenes de hasta 2400px de alto, porque WhatsApp achica las fotos a ~1600px y con un ticket muy largo el texto dejaría de leerse. Cada hoja repite el número de ticket y el encabezado del grupo cortado, y lleva "Hoja i de n".
- **`src/functions/shareFiles.ts`** (nuevo): `shareFiles` (Web Share con archivos; si no hay soporte, descarga) y `downloadFiles`. Comparte **solo** `files`: en iOS, si se agrega `text`, WhatsApp descarta los archivos.
- **`src/functions/makeTicket.ts`**: el contenido del ticket (líneas de usuario, ticket, fecha, grupos, filas y total) pasa a `buildTicketContent`, que comparten el PDF y la imagen. Se agrega el tipo `PrintableTicket`. El PDF térmico sale idéntico byte a byte (verificado comparando la salida antes y después). La columna de número pasa de medirse con jsPDF a la constante `NUM_COL = 15`, que da el mismo valor.
- **`src/features/make-plays/*`**: `ticketToShare`/`setTicketToShare` en `MakePlaysContext`. `MakePlaysProvider` ya no genera ni comparte el PDF en `onSuccess`: solo abre el modal. "Reimprimir" (`header-play-detail.tsx`) también abre el modal.

### Removed - 2026-10-05

- **`sharePdfBlob`** (`src/functions/makeTicket.ts`): reemplazado por `shareFiles`. Su respaldo abría `wa.me` solo con texto, sin el archivo adjunto.

### Fixed - 2026-10-04 (Imprimir jugadas)

- **`src/features/plays-and-hits/print-grouped-bets-button.tsx`**: el botón Imprimir pedía `limit=9999` en un solo request, pero Supabase corta cada respuesta en `max_rows = 1000`. Por eso, con más de 1000 jugadas, el PDF salía incompleto. Ahora busca al hacer click, de a 900 por página (`page`/`limit`, el endpoint ya los aceptaba), hasta que llega una página incompleta, y descarta repetidos por `bet_id`. Usa los mismos filtros que la tabla y el mismo fallback de fecha: sin filtros imprime todas las jugadas del día. Ya no se precarga el listado completo al entrar a la página, y si no hay jugadas avisa con un toast en vez de dejar el botón deshabilitado.
- **`src/functions/printGroupedBetsPDF.ts`**: la primera página lleva un resumen antes de las jugadas: cantidad de apuestas y monto total, cantidad de premios y monto en premios, y total de tickets (este último solo sin agrupar). Se calcula sobre las jugadas impresas, así respeta todos los filtros. Los agregados del backend ignoran ganadores, terna, cuaterna y monto mínimo. La primera página tiene menos filas para dejar lugar al resumen.

### Fixed - 2026-10-04 (Configuración)

- **`src/hooks/mutations/settings/useCleanupOldData.ts`**: el backend ahora borra el archivo viejo de a lotes, así que el hook repite `POST /settings/cleanup` hasta `done`, acumula lo borrado, informa el progreso con `onProgress` y reintenta hasta 3 fallas seguidas (borrar es idempotente; un 502 del proxy no significa que el lote no se haya borrado). Invalida `storageStatus` en `onSettled`, también si falla a mitad de camino.
- **`src/features/settings/index.tsx`**: muestra el progreso del borrado. Corrige el porcentaje de uso: calculaba `GB / 7` (0.45 en vez de 45%), así que la barra de `Progress` quedaba casi vacía. También agrega la unidad "GB".

### Removed - 2026-09-28 (Polla se separa de QuiniApp)

#### Se saca toda la Polla de QuiniApp
La Polla pasa a ser un sistema aparte con su propio frontend (`polla-web/`), así que QuiniApp queda sin rastro de ella.

- Eliminados: `src/features/polla/`, `src/features/polla-editions/`, `src/pages/Polla.tsx`, `src/pages/PollaEditions.tsx`, `src/components/PollaNumberGrid.tsx`, los cuatro modales `*Polla*`, `src/hooks/{fetchs,mutations}/polla-*/` y `src/features/terminal-ticket/usePollaBetForTicket.ts`.
- `src/functions/makePollaTicket.ts` se movió a `polla-web/src/functions/`.
- Sacadas las filas de Polla de `termina-ticket-play-table.tsx` y `terminal-ticket-matches-table.tsx`, las rutas `POLLA`/`POLLA_EDITIONS` de `src/types/routes.type.ts`, `src/routes/route.tsx` y `src/constants/SidebarMenu.tsx`, y los endpoints `polla_edition`/`polla_bet` de `routes/routes.ts`.


### Added - 2026-09-21 (Impresión de ticket de Polla)

#### Modelo de impresión térmica 58mm para tickets de Polla
- **`web/src/functions/makePollaTicket.ts`**: `makePollaTicketPdf`, mismas convenciones que `makeTicket.ts` (58mm, monoespaciado Courier, 32 caracteres por línea, altura calculada en base al contenido). Los 10 números se imprimen en grilla de 2 columnas x 5 filas numeradas (`1. xx   2. xx` / `3. xx   4. xx` / ...), más quiniela/turno, semana de juego, valor de ticket y pozo.
- **`web/src/components/modals/CreatePollaBetModal.tsx`**: al cargar una jugada, imprime (desktop) o comparte (mobile, mismo criterio que la carga de tickets normales) el comprobante automáticamente.
- **`web/src/features/polla/index.tsx`**: botón "Imprimir" en cada fila para reimprimir cualquier jugada ya cargada.
- `useCreatePollaBet` ahora tipa la respuesta (`{ data: { bet } }`) en vez de `unknown`, necesario para poder armar el PDF con los datos que devuelve la creación.

### Changed - 2026-09-21 (Página dedicada de Polla)

#### Toda la operatoria de Polla se consolida en `/polla`
Antes estaba repartida: botón de carga en "Realizar Jugadas", tabla de seguimiento en "Jugadas y Aciertos", y edición/borrado de jugadas en la página admin de ediciones. Ahora vive todo en una pantalla nueva bajo el menú "Jugadas".

- **`web/src/features/polla/index.tsx`** (`web/src/pages/Polla.tsx`, ruta `ROUTES.POLLA` = `/polla`): selector de edición + selector de pasador (admin/owner; cajero ve solo lo suyo, mismo patrón que `PlayAndHitsSelect`) + switch **Cargadas/Jugando**. "Cargadas" lista ticket/pasador/números/fecha con editar y borrar inline (admin/owner, antes de `load_limit_date`, jugada no ganadora). "Jugando" ordena por aciertos descendente y pinta cada uno de los 10 números en verde si ya salió (`hit_numbers`), mostrando "Ganador · $premio" o "En juego". Botón "Cargar Jugada" (deshabilitado sin pasador elegido) abre `CreatePollaBetModal`.
- Entrada de menú "Polla" agregada dentro de "Jugadas" (`web/src/constants/SidebarMenu.tsx`), junto a Realizar Jugadas/Jugadas y Aciertos/Revisar Ticket.
- **Removido** (superseded por la página nueva): botón "Cargar Polla" y modal en `header-play-detail.tsx`; `web/src/features/plays-and-hits/polla-plays-table.tsx`; `web/src/components/modals/PollaBetsListModal.tsx` y el botón "Ver jugadas" en `features/polla-editions` (esa página ahora solo maneja la configuración de la edición: fechas, pozo, valor de ticket).
- `GET /polla_bet` ahora también acepta `ticket_number` (usado por "Revisar Ticket" para mostrar la jugada de Polla de un ticket).

### Added - 2026-09-20 (Juego Polla)

#### Página admin de configuración de Polla
- **`web/src/pages/PollaEditions.tsx`** / **`web/src/features/polla-editions/index.tsx`**: listado de ediciones de Polla (quiniela, turno, fechas, pozo, valor de ticket, estado), calcado del patrón de `features/lotteries`. Modales lazy `CreatePollaEditionModal`/`UpdatePollaEditionModal`/`DeletePollaEditionModal` en `web/src/components/modals/`.
- Hooks nuevos: `web/src/hooks/fetchs/polla-edition/usePollaEditions.ts`, `web/src/hooks/mutations/polla-edition/{useCreatePollaEdition,useUpdatePollaEdition,useDeletePollaEdition}.ts`.
- Ruta `ROUTES.POLLA_EDITIONS` (`/polla-editions`) registrada en `web/src/routes/route.tsx` y en el menú lateral (`web/src/constants/SidebarMenu.tsx`, junto a "Loterias").

#### Carga de jugada de Polla (todos los roles)
- **`web/src/components/PollaNumberGrid.tsx`**: grilla compartida de números 00-99 (usada por carga y edición).
- **`web/src/components/modals/CreatePollaBetModal.tsx`**: elegir 10 números; lista solo ediciones con carga abierta (`load_limit_date >= hoy`). Cada confirmación genera un ticket independiente (no se mezcla con el ticket de quiniela normal). Resuelve el dueño de la jugada igual que la carga de tickets normales (`cashier` buscado o uno mismo).
- **`web/src/features/make-plays/header-play-detail.tsx`**: botón "Cargar Polla" visible para todos los roles (antes solo cajero), integrado en la misma fila de controles (no en línea aparte); en mobile muestra solo el texto "Polla" sin ícono.
- Hook nuevo: `web/src/hooks/mutations/polla-bet/useCreatePollaBet.ts`.
- Ruta `polla_edition`/`polla_bet` agregadas a `web/routes/routes.ts`.

#### Editar/borrar jugadas de Polla (admin/owner)
- **`web/src/components/modals/PollaBetsListModal.tsx`**: lista las jugadas de una edición con edición inline de números y borrado con confirmación, habilitado solo mientras no pasó `load_limit_date` y la jugada no ganó. Accesible desde un botón nuevo en cada tarjeta de `features/polla-editions`.
- Hooks nuevos: `web/src/hooks/fetchs/polla-bet/usePollaBets.ts`, `web/src/hooks/mutations/polla-bet/{useUpdatePollaBet,useDeletePollaBet}.ts`.

#### Jugadas de Polla en "Jugadas y Aciertos"
- **`web/src/features/plays-and-hits/polla-plays-table.tsx`**: tabla adicional (números, aciertos, premio, ticket, usuario) que aparece bajo la tabla de quiniela normal cuando hay quiniela+turno seleccionados y existen jugadas de Polla para esa fecha.

### Changed - 2026-07-19 (Calendario mobile)

#### Header de Realizar Jugadas en pantallas chicas
- **`web/src/features/make-plays/header-play-detail.tsx`**: el header no-cajero desbordaba en mobile y el select de Ticket quedaba fuera de pantalla. Ahora la fila hace `flex-wrap`: fecha + buscador de usuario en la primera línea (el nombre del cajero trunca con `min-w-0`), select de Ticket a ancho completo en la segunda. En `sm:`+ queda igual que antes.

#### Targets táctiles más grandes en el calendario
- **`web/src/components/ui/calendar.tsx`**: en mobile los días pasan de 32px (`size-8`) a 36px (`size-9`), flechas de navegación a `size-8`, texto de días/encabezados/caption más grande y caption capitalizado. En `sm:` y superior mantiene el tamaño compacto anterior. Aplica a todos los date pickers (usan este componente base).
- **`web/src/components/button/SelectDayToSearch.tsx`**: `collisionPadding={8}` y `max-w-[calc(100vw-16px)]` en el `PopoverContent` para que el calendario nunca desborde el viewport en pantallas angostas.
- **`web/src/styles/index.css`**: el CSS global de tablas (`th, td { padding: 8px !important }` + rayado de filas pares) pisaba el `p-0` del calendario — celdas de 52px, tabla de 364px que desbordaba viewports de 320px, y franjas azules en las semanas. Se agregó excepción scoped `.rdp th/td { padding: 0 !important }` y `.rdp tr:nth-child(even)` transparente. Verificado con Playwright a 320×480: tabla 252px, celdas 36px. Las tablas de datos no cambian.

### Added - 2026-07-19 (Jugadas con fecha pasada para admin+)

#### Selector de fecha en Realizar Jugadas (solo roles no-cajero)
- **`web/src/features/make-plays/header-play-detail.tsx`**: nuevo `SelectDayToSearch` visible solo para ADMIN/SUPERADMIN/CAPITALIST/OWNER, manejado por query param `date` (sin param = hoy). Permite crear tickets fechados en el pasado. El select "Ticket" ahora lista los tickets del día elegido (antes siempre hoy).
- **`web/src/features/make-plays/provider/MakePlaysProvider.tsx`**: los dos builders de payload (`handleCreateBet`, `handleConfirmClosedSchedules`) usan `getEffectiveDate()`: lee el query param `date` para roles no-cajero, con fallback a hoy si falta, es inválido (regex `YYYY-MM-DD` de `@helper/functions/dateRegex`) o es futuro. Cajeros siempre envían hoy (y el server lo fuerza igual).

### Fixed - 2026-07-19 (Calendarios)

#### SelectDayToSearch — mes inicial y cap de fechas futuras
- **`web/src/components/button/SelectDayToSearch.tsx`**:
  - `defaultMonth={date}`: al abrir el calendario con una fecha seleccionada de otro mes, ahora muestra ese mes (antes siempre abría en el mes actual, porque react-day-picker v8 sin `defaultMonth`/`month` cae al mes de hoy y el Calendar se monta fresco en cada apertura del Popover).
  - `toDate` ahora tiene default `dayjs().toDate()`: ningún date picker permite seleccionar fechas futuras aunque el caller no pase `toDate`. Esto capa el calendario de Resultados (`features/results/index.tsx`), el único que no lo pasaba.

### Removed - 2026-07-19
- **`web/src/features/plays-and-hits/select-day-to-search.tsx`**: duplicado muerto de `SelectDayToSearch` sin ningún import.

### Added - 2026-06-27 (High Availability)

#### Transparent backend failover in the Vercel proxy
- **`web/api/api-proxy.ts`**: the serverless proxy now fails over from the main backend
  (`API_BASE_URL`, Railway) to a backup (`API_BASE_URL_BACKUP`, Render) when the main is
  unreachable. The switch is invisible to the browser — same-origin cookies are preserved, so the
  session survives (both backends share Supabase + JWT secrets).
  - Conservative failover: GET/HEAD retry on any primary failure (connection error, 4s timeout, 5xx);
    mutations (POST/PUT/PATCH/DELETE) retry **only** on connection-level errors that prove the
    request never reached the primary (ECONNREFUSED/DNS/TLS) — never on timeout/5xx — to avoid
    duplicate writes.
  - Request body is buffered once and reused across both attempts.
  - In-instance circuit breaker skips the primary for 30s after a connection failure (avoids paying
    the timeout on every request during a sustained outage).
  - Returns `502 { error: { code: 'BACKEND_UNAVAILABLE' } }` when both backends are unreachable.
- **New env (Vercel)**: `API_BASE_URL_BACKUP` = public URL of the Render backup.

### Changed - 2026-06-11

#### Dependencies
- **`@vercel/speed-insights`**: Actualizado de `^1.2.0` a `^2.0.0`
  - API sin cambios: `<SpeedInsights />` desde `@vercel/speed-insights/react` (verificado: export `/react` se mantiene en v2, compatible con React 18)
  - v2 soporta `sampleRate` y `beforeSend` para control de muestreo/costos
  - Build de producción verificado sin errores

### Fixed - 2026-05-16 (Auth)

#### Rate Limit 429 Resilience
- **`web/src/lib/apiClient.ts`**: `refreshAccessToken()` now returns `true` on HTTP 429 instead of `false`
  - Previous behavior: 429 from `/api/auth/refresh` triggered immediate logout
  - New behavior: rate-limited refresh is treated as success; session stays alive; periodic `validate()` (5 min) handles actual expiration
  - Why: CGNAT means many users share the same IP; if the AUTH hard cap is hit, users should not be disconnected

### Added - 2026-05-16 (Security)

#### CSRF Header
- **`web/src/lib/apiClient.ts`**: All outbound requests now include `X-Requested-With: XMLHttpRequest` header
  - Added to `request()` default headers (covers all `get/post/put/delete/patch` calls)
  - Added to `fetchRaw()` merged headers (covers all `fetchWithAuth` hooks)
  - Added to `refreshAccessToken()` direct fetch call

### Added - 2026-05-16

#### Current Account — "Descontar del subtotal" al liquidar deje

- **`web/src/components/modals/UserCurrentAccountModal.tsx`**: Nuevo checkbox "Descontar del subtotal" que aparece cuando "Liquidar deje" está activo. Al marcar ambos, envía `leave_in_subtotal=true` al backend.
- **`web/src/hooks/mutations/current-account/useUpdateCurrentAccoutnByUser.ts`**: Agregado `leaveInSubtotal` a `UpdateVars` y al URL de la petición.

#### Settings — cleanup button conectado

- **`web/src/hooks/mutations/settings/useCleanupOldData.ts`**: Hook `useMutation` que llama `POST /api/private/settings/cleanup`. Invalida `storageStatus` en `onSuccess`.
- **`web/src/features/settings/index.tsx`**: Reemplazado mock `handleCleanup` por mutación real. Botón muestra "Limpiando..." durante la petición. Toast muestra conteo de apuestas y tickets eliminados. Removido selector de período (la API usa 65 días fijos).
- **`web/routes/routes.ts`**: Agregada ruta `settings.cleanup`.

### Changed - 2026-05-02

#### Liquidación Individual — mejoras de UI y campos editables

- **`web/src/components/modals/UserCurrentAccountModal.tsx`**: Layout del modal ahora apila columnas en mobile (`flex-col sm:flex-row`) para ambas secciones de campos y tablas. Las tablas tienen altura fija con `overflow-y-auto` para scroll independiente en mobile.
- **`web/src/components/modals/UserCurrentAccountModal.tsx`**: Checkbox "Liquidar deje" tiene `className="border-white bg-white"` para mayor visibilidad.
- **`web/src/components/modals/UserCurrentAccountModal.tsx`**: Los campos `pass`, `successes`, `drag`, `revenue` ahora se envían al backend en el submit (coincide con cambios en API).

### Fixed - 2026-04-30

#### Cuenta Corriente — invalidación de caché para todos los días

- **`web/src/hooks/mutations/current-account/useCalculateCurrentAccount.ts`**: `onSuccess` cambiado de `refetchQueries` a `invalidateQueries({ queryKey: ['getCurrentAccount'] })`. El cambio asegura que todos los días cacheados se marquen como stale tras el cálculo/cascade, no solo el día activo en pantalla.

### Changed - 2026-04-29

#### Resultados — soporte de 3 o 4 cifras (longitud uniforme)

- **`web/src/features/results/provider/ResultsProvider.tsx`**: `canSave` y validación en `handleSave` actualizados para aceptar 20 resultados de 3 dígitos o 20 de 4 dígitos. Longitudes mixtas siguen siendo inválidas.

### Added - 2026-04-23

#### Jugadas y Aciertos — filtro cota mínima en modo agrupado

- **`web/src/features/plays-and-hits/min-amount-input.tsx`**: Nuevo input numérico que aparece solo cuando `grouped=true`. Al aplicar (blur o Enter) escribe `min_amount` en los URL params; si el valor es 0 o vacío lo elimina. La tabla ya leía ese param y lo enviaba al RPC (`HAVING SUM >= p_min_amount`).
- **`web/src/features/plays-and-hits/index.tsx`**: Renderiza `MinAmountInput` junto a `PlayAndHitsToggleSelect` y `PrintGroupedBetsButton`.
- **`web/src/features/plays-and-hits/play-and-hits-toggle-select.tsx`**: Al desactivar modo agrupado elimina `min_amount` de los URL params para evitar que persista en modo individual.

### Fixed - 2026-04-23

#### Jugadas Agrupadas — impresión ignoraba filtro min_amount

- **`web/src/hooks/fetchs/plays/useBets.ts`**: Agregado `min_amount` a `FetchBetsProps`, `betsKey` y `fetchBets` para que el hook lo envíe como query param al backend.
- **`web/src/features/plays-and-hits/print-grouped-bets-button.tsx`**: Lee `min_amount` de los URL params y lo pasa a `useBets`, alineando los datos del PDF con los de la tabla.

#### Exportar Diario — diálogo de impresión se cerraba al cambiar configuración

- **`web/src/functions/pdf-shared.ts`**: `openPDFPrintDialog` usaba `setTimeout` de 1000ms para limpiar el iframe, lo que eliminaba el iframe (y cerraba el diálogo) mientras el usuario todavía interactuaba con la configuración de impresión. Reemplazado por el evento `afterprint` que dispara solo cuando el usuario cierra el diálogo.

### Added - 2026-04-21

#### Cuenta Corriente — mejoras de UI y exportaciones

- **`web/src/features/current-account/index.tsx`**: Reorganización de botones con iconos lucide-react. Exportaciones agrupadas en grid 2 columnas; "Actualizar" separado al final con ancho completo.
- **`web/src/components/modals/PrintSubtotalsModal.tsx`**: Añadido gestión de gastos (con scope de grupo) y campo % capitalista, igual que `PrintTotalsModal`. Soporta modo día (gastos + % sobre saldo neto) y modo rango (% sobre total).
- **`web/src/hooks/fetchs/org-expense/useGetOrgExpenses.ts`**: Nuevo parámetro `groupId` en key y fetch — filtra gastos por grupo o nivel-org.
- **`web/src/hooks/mutations/org-expense/useCreateOrgExpense.ts`**: Acepta `group_id` en payload para vincular gasto a grupo específico.
- **`web/src/hooks/mutations/org-expense/useDeleteOrgExpense.ts`**: Acepta `groupId` para invalidar cache correctamente con scope de grupo.

### Changed - 2026-04-21

#### Resumen Cuenta Corriente — agregar modo día/rango

- **`web/src/components/modals/PrintDailySummaryModal.tsx`**: Agregado selector Día/Rango. Modo día + grupo → PDF por pasadores. Modo rango (con o sin grupo) → PDF por fecha. Antes con grupo seleccionado solo mostraba un único datepicker.

#### Exportar Subtotales — porcentaje capitalista solo en modo rango

- **`web/src/components/modals/PrintSubtotalsModal.tsx`**: Porcentaje capitalista movido dentro del bloque `mode === 'range'`. Modo día solo muestra fecha y gastos; modo rango solo muestra rango de fechas y porcentaje. Removido `percentage` del llamado a `printSubtotalsDayTicket`.

#### Cuenta Corriente — cuadro de impresión

- **`web/src/functions/printLiquidationAdmin.ts`**: `downloadCurrentAccountTablePDF` y `downloadCurrentAccountDailySummaryPDF` usan `printPdfBlob` (cuadro de impresión del navegador) en lugar de `doc.save()` (descarga directa).
- **`web/src/functions/printTotalsTicket.ts`**: `printSubtotalsDayTicket` acepta `expenses` y `percentage`; muestra gastos, saldo neto y % capitalista. `printSubtotalsRangeTicket` acepta `percentage`.
- **`web/src/components/modals/PrintTotalsModal.tsx`**: Gastos filtrados por grupo — pasa `effectiveGroupId` a hooks y fetch.

### Fixed - 2026-04-21

#### Ticket bets not loading when date in URL differs from ticket date
- **`web/src/hooks/fetchs/plays/useInfiniteBetsByTicketNumber.ts`**: Derive effective `date` from first 8 chars of `ticket_number` (`YYYYMMDD`) instead of using the URL date param. Fixes case where user views a ticket from a previous day while the URL date is today. Also relaxed `enabled` to only require `ticket_number` (date always derivable from it).

#### Ticket search by number — compatibility with new format
- **`web/src/hooks/fetchs/tickets/useGetTicketByNumber.ts`**: Changed `length === 17` to `length >= 17` so search works with new ticket format `YYYYMMDDHHmmssSSS-N` (includes cashier number suffix).
- **`web/src/features/terminal-ticket/form-header-filter.tsx`**: Changed ticket number input `type="number"` → `type="text"` so the dash in the new format is accepted. Cashier users who type only the base number (without `-N` suffix) get it auto-appended from their own `user.number`.
- **`web/src/components/modals/repeat-ticket-modal.tsx`**: Same fixes — `type="text"` input, and cashier auto-append of `-{user.number}` suffix when missing.

### Added - 2026-04-20

#### UX/UI General — Mobile responsiveness & layout improvements
- **`web/src/components/mobile-bottom-nav/index.tsx`**: New bottom tab bar for mobile (`md:hidden`). Shows 4 main routes (Jugadas, Aciertos, Ticket, Resultados) + "Más" button that opens the existing sidebar Sheet via `useSidebar().toggleSidebar()`. Fixed at bottom with safe-area inset support.
- **`web/src/components/layout/index.tsx`**: Added `MobileBottomNav`, max-width container (`max-w-[1440px]`) on content, increased mobile padding (`px-3`), added `pb-16 md:pb-0` to reserve space for bottom nav.

### Changed - 2026-04-20

#### UX/UI General — Mobile responsiveness & layout improvements
- **`web/src/styles/index.css`**: Fixed CSS variable typos: `--bg-accen` → `--bg-accent`, `--border-top` → `--rounded-top`.
- **`web/src/components/footer/index.tsx`**: Footer now shows time and date on same line on mobile (flex-row). Reduced clock font size for mobile (`text-xl sm:text-2xl 1440:text-4xl`).
- **`web/src/components/wrapper/PageWrapper.tsx`**: Increased gap between sections (`gap-2 sm:gap-3 2xl:gap-4`).
- **`web/src/components/header-section/index.tsx`**: Title now visible on all screen sizes (removed `hidden sm:flex`). Icon hidden on mobile only. Added `bg-background z-10` for sticky behavior. Hoisted `useMediaQuery` call to component top level.
- **`web/src/components/button/IconButton.tsx`**: Increased mobile touch target (`h-7` → `h-10`).
- **`web/src/constants/SidebarMenu.tsx`**: Fixed typos "Qunielas y Turnos" → "Quinielas y Turnos" and "Qunielas a jugarse" → "Quinielas a jugarse".
- **`web/src/components/button/SelectDayToSearch.tsx`**: Calendar now starts on Sunday (`weekStartsOn: 0`).
- **`web/src/components/modals/PrintTotalsModal.tsx`**: Added `toDate={dayjs().toDate()}` to all calendar pickers — max date is today.
- **`web/src/components/modals/PrintDailySummaryModal.tsx`**: Added `toDate={dayjs().toDate()}` to dateFrom and dateTo pickers.
- **`web/src/components/modals/PrintSubtotalsModal.tsx`**: Added `toDate={dayjs().toDate()}` to all calendar pickers.
- **`web/src/features/upcoming-lotteries/index.tsx`**: Hoisted `useMediaQuery` calls. Save button now responsive (`w-full sm:w-[200px]`). Reduced padding on sections for mobile.
- **`web/src/features/user-list/user-table.tsx`**: Table wrapper now uses `overflow-x-auto`, table has `min-w-[700px]` — horizontal scroll on mobile.
- **`web/src/features/groups/index.tsx`**: Two-column grid now responsive (`grid-cols-1 md:grid-cols-2`).
- **`web/src/features/organizations/index.tsx`**: Table wrapped in `overflow-x-auto`. ID column hidden on mobile (shown on sm+). Action button labels hidden on mobile (icon only). UUID truncated to 8 chars with full UUID as title tooltip.
- **`web/src/features/current-account/index.tsx`**: Export button grid now `grid-cols-1 sm:grid-cols-2` — single column on mobile for easier tapping.
- **`web/src/features/make-plays/fill-out-a-ticket.tsx`**: Fixed `flex-col-reverse` → `flex-col` so form appears first on mobile (before lottery checkboxes).
- **`web/src/features/make-plays/results-overview.tsx`**: Added `border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.3)]` to visually separate sticky action bar from content.

### Added - 2026-04-20

#### Cuenta Corriente — Totales CC (A4) y Subtotales (ticket)

#### Cuenta Corriente — Totales CC (A4) y Subtotales (ticket)
- **`web/src/hooks/fetchs/current-account/useGetCurrentAccountDailySummary.ts`**: New fetch hook `fetchCurrentAccountDailySummary(date_from, date_to, group_id)` calling `GET /daily-summary`. Returns `DailySummaryEntry[]` with all CC fields aggregated per day.
- **`web/src/functions/printLiquidationAdmin.ts`**: Added `downloadCurrentAccountDailySummaryPDF` — A4 landscape PDF with one row per date; columns: Fecha, Pase, Aciertos, Reclamos, Subtotal, Deuda, Cobros, Pagos, Total, Arrastre, Deje + totals footer.
- **`web/src/functions/printTotalsTicket.ts`**: Added `printSubtotalsDayTicket` (per-cashier subtotals for a single day) and `printSubtotalsRangeTicket` (per-day subtotals for a date range).
- **`web/src/components/modals/PrintDailySummaryModal.tsx`**: Modal for button 1 — date range + group selector, prints A4 daily summary PDF.
- **`web/src/components/modals/PrintSubtotalsModal.tsx`**: Modal for button 2 — day/range mode + group selector, prints subtotals ticket.
- **`web/src/features/current-account/index.tsx`**: Added "Totales CC (A4)" and "Imprimir Subtotales" buttons; lazy-loaded new modals.
- **`web/routes/routes.ts`**: Added `daily_summary` route to `current_account`.

### Fixed - 2026-04-19

#### Session race condition — concurrent refresh kicks all devices
- **`web/src/lib/apiClient.ts`**: Added `safeRefresh()` public method that checks `isRefreshing` mutex before starting a token refresh. Prevents the proactive timer from racing with a 401-triggered refresh on the same device. Added `fetchRaw()` method that routes raw fetch calls through the same mutex + refresh logic.
- **`web/src/providers/AuthProvider.tsx`**: `refreshAccessToken` now calls `apiClient.safeRefresh()` instead of `apiClient.post('/auth/refresh')` directly.
- **`web/src/lib/fetchWithAuth.ts`**: Now routes through `apiClient.fetchRaw()` instead of raw fetch. All 48+ hooks using `fetchWithAuth` now benefit from the shared refresh mutex — a 401 triggers token refresh + retry instead of immediate logout.
- **Why**: `fetchWithAuth` dispatching immediate logout on 401 could race with `apiClient`'s refresh, sending two concurrent refresh requests with the same cookie → token reuse detected → all sessions revoked.

### Fixed - 2026-04-17

#### Ticket PDF — impresora térmica comprime texto
- **`web/src/functions/makeTicket.ts`**: Thermal printers concatenate all `doc.text()` calls at same Y coordinate, ignoring X positions. Fix: each row now built as a single padded string — `padLine()` helper for two-column Helvetica rows (Fecha/Hora, date/time), char-width padding for three-column Courier bet rows (num/type/amount).

### Added - 2026-04-16

#### Imprimir Totales — Cuenta Corriente
- **`web/routes/routes.ts`**: Agrega ruta `totals` en `current_account` → `/api/private/current_account/totals`
- **`web/src/hooks/fetchs/current-account/useGetCurrentAccountTotals.ts`**: Nuevo hook `useGetCurrentAccountTotals(date_from, date_to, group_id?)` y función `fetchCurrentAccountTotals` para obtener totales agrupados por día en un rango de fechas
- **`web/src/functions/printTotalsTicket.ts`**: Dos funciones de impresión en formato ticket 80mm portrait:
  - `printDailyTotalsTicket`: ticket diario con secciones "Me Pagó" / "Le Pagó", gastos manuales y saldo del día
  - `printRangeTotalsTicket`: ticket de rango con totales por día, suma total y porcentaje configurable para capitalista
- **`web/src/components/modals/PrintTotalsModal.tsx`**: Modal con opciones de impresión — modo día/rango, filtro por grupo, carga dinámica de gastos (nombre + monto) en modo día, y porcentaje editable en modo rango
- **`web/src/features/current-account/index.tsx`**: Agrega botón "Imprimir Totales" que abre `PrintTotalsModal`, pre-poblado con fecha y grupo activos de la tabla

### Added - 2026-04-14

#### Ticket Idempotency
- **`MakePlaysProvider`**: Generates a `clientRequestIdRef` UUID lazily on first submit attempt; sends it as `client_request_id` in the ticket creation payload; clears it on `onSuccess` and on manual reset (`handleResetBets`, `handleRecreateBet`, edit `onSuccess`)
- **Why**: Prevents duplicate tickets when cashiers retry after a network failure — the server returns the already-created ticket on duplicate key
