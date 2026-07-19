# Changelog

All notable changes to the Helper workspace are documented in this file.

## [Unreleased]

### Changed - 2026-07-19

#### Ticket Schema
- **`helper/schemas/ticket.schema.ts`**: `newTicketSchema.date` pasa de `z.string()` a `z.string().regex(dateRegex)` (importado de `helper/functions/dateRegex.ts`). El cliente siempre envió `YYYY-MM-DD`; ahora el formato queda validado en el borde. Soporta la feature de tickets backdateados por admin.

### Changed - 2026-04-29

#### Results Schema — soporte de 3 o 4 cifras

- **`helper/schemas/results.schema.ts`**: `newResultsSchema` y `editResultsSchema` actualizados. Regex cambiado de `/^\d{4}$/` a `/^\d{3,4}$/`. Agregado `.superRefine()` para validar que todos los resultados tengan la misma longitud (todos 3 o todos 4). El RPC `generate_winners` es compatible sin cambios (usa `ends_with` basado en sufijos).

### Added - 2026-04-14

#### Ticket Types
- **`client_request_id`**: Added optional field to `ITicketEntityBase` (`string | null`), `INewTicketEntity` (`string`), and `newTicketSchema` (optional UUID) for idempotency key support
