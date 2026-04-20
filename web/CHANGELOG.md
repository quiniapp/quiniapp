# Changelog

All notable changes to the Web workspace are documented in this file.

## [Unreleased]

### Added - 2026-04-20

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
