# Changelog

All notable changes to the Helper workspace are documented in this file.

## [Unreleased]

### Changed - 2026-10-05 (Polla: ajustes del cliente)

- **`polla/schemas/game.schema.ts`**: las jugadas aceptan números repetidos (`distinctNumbers` pasa a `betNumbers`, que solo exige 10 números de 2 cifras).
- **`polla/schemas/user.schema.ts`**: `fee_plus` deja de ser obligatorio para el pasador, porque la liquidación de Polla no tiene deje.
- **`polla/schemas/auth.schema.ts`**: `updatePollaPreferencesSchema` (`theme`).
- **`polla/types/user.type.ts`**: enum `POLLA_THEME` (`light`/`dark`) y `theme` en `IPollaUserEntityBack` y `IPollaSessionUser`.
- **`polla/types/game.type.ts`**:
  - `IPollaBetEntityBack.hit_dates`: fecha del acierto de cada casillero.
  - `IPollaBetDerivedFields` (`group_name`, `client_name`).
  - `IPollaBetAnonymous` pasa a `IPollaBetPublic`, la proyección de pasador y jugador con nombres, `is_mine` y `can_edit`; `isAnonymousPollaBet` pasa a `isPublicPollaBet`.
  - `IPollaBetToRepeat`.
  - `IPollaProcessedEdition`/`IPollaProcessResult`.
  - `IPollaEditionEntityFront` deja `bets_count`/`collected_amount` como opcionales, porque solo admin+ los recibe.

### Changed - 2026-09-28 (Polla se separa de QuiniApp)

#### Namespace propio `helper/polla/`
Los tipos de Polla dejan de mezclarse con los de QuiniApp: el sistema ahora tiene usuarios, organizaciones y catálogos propios, así que su contrato compartido vive en su propio árbol.

- **`helper/polla/types/user.type.ts`**: `POLLA_USER_TYPE` (suma `PLAYER` a la jerarquía), `POLLA_USER_HIERARCHY`, helpers `isPollaAdminRole`/`isPollaStaffRole`, entidades y `IPollaSessionUser`.
- **`helper/polla/types/catalog.type.ts`**: organizaciones, grupos, quinielas y turnos.
- **`helper/polla/types/game.type.ts`**: ediciones, resultados, jugadas (incluida la proyección anónima `IPollaBetAnonymous` que recibe un jugador), movimientos de crédito y cuenta corriente.
- **`helper/polla/schemas/`**: `auth`, `catalog`, `user` (con validación de signo por tipo de movimiento de crédito) y `game` (ediciones con reglas cruzadas de fechas, resultados de 20 números del mismo largo, jugadas de 10 números distintos, cuenta corriente). Los tipos de payload se infieren con `z.infer` en vez de duplicarse en `request/`.
- **`helper/polla/config/session.config.ts`**: nombres de cookie (distintos de los de QuiniApp a propósito: las dos apps pegan al mismo dominio de API), TTLs, intervalos de validación y tamaños de página.
- **Eliminados**: `types/polla-bet.type.ts`, `types/polla-edition.type.ts`, `request/polla-*.ts`, `response/polla-*.ts` y `schemas/polla-*.ts`.


### Added - 2026-09-20 (Juego Polla)

#### Tipos, requests, responses y schemas de Polla
- **`helper/types/polla-edition.type.ts`**: `POLLA_EDITION_STATUS` enum, `IPollaEditionEntityBack`/`IPollaEditionEntityFront`.
- **`helper/types/polla-bet.type.ts`**: `IPollaBetEntityBack`/`IPollaBetEntityFront` (numbers, hit_numbers, hits, winner, prize).
- **`helper/request/polla-edition.request.ts`**, **`helper/request/polla-bet.request.ts`**.
- **`helper/response/polla-edition.response.ts`**, **`helper/response/polla-bet.response.ts`**.
- **`helper/schemas/polla-edition.schema.ts`**: `newPollaEditionSchema`/`updatePollaEditionSchema` con `superRefine` cross-field (`load_limit_date < start_date`, `start_date <= end_date`).
- **`helper/schemas/polla-bet.schema.ts`**: `newPollaBetSchema`/`updatePollaBetSchema` — array de 10 strings `/^\d{2}$/` con validación de unicidad.
- **`helper/types/polla-bet.type.ts`**: agrega `ticket_number`, `deleted_at`, `deleted_by` a `IPollaBetEntityBack` (los dos últimos excluidos del tipo Front).
- **`helper/request/polla-bet.request.ts`**: agrega `IUpdatePollaBetEntity`/`IDeletePollaBetEntity` para edición/borrado de jugadas.

### Changed - 2026-07-19

#### Ticket Schema
- **`helper/schemas/ticket.schema.ts`**: `newTicketSchema.date` pasa de `z.string()` a `z.string().regex(dateRegex)` (importado de `helper/functions/dateRegex.ts`). El cliente siempre envió `YYYY-MM-DD`; ahora el formato queda validado en el borde. Soporta la feature de tickets backdateados por admin.

### Changed - 2026-04-29

#### Results Schema — soporte de 3 o 4 cifras

- **`helper/schemas/results.schema.ts`**: `newResultsSchema` y `editResultsSchema` actualizados. Regex cambiado de `/^\d{4}$/` a `/^\d{3,4}$/`. Agregado `.superRefine()` para validar que todos los resultados tengan la misma longitud (todos 3 o todos 4). El RPC `generate_winners` es compatible sin cambios (usa `ends_with` basado en sufijos).

### Added - 2026-04-14

#### Ticket Types
- **`client_request_id`**: Added optional field to `ITicketEntityBase` (`string | null`), `INewTicketEntity` (`string`), and `newTicketSchema` (optional UUID) for idempotency key support
