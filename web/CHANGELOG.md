# Changelog

All notable changes to the Web workspace are documented in this file.

## [Unreleased]

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
