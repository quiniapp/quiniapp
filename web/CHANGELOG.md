# Changelog

All notable changes to the Web workspace are documented in this file.

## [Unreleased]

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
