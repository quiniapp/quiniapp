# Changelog

All notable changes to the Helper workspace are documented in this file.

## [Unreleased]

### Changed - 2026-10-22 (Polla: grupos con admin, corte por rol, edición de pollas y repetir tickets)

- **`polla/types/user.type.ts`**:
  - `POLLA_SUPER_ROLES` / `isPollaSuperRole` (dueño, capitalista y superadmin): ediciones, quinielas, turnos, resultados, grupos y cuenta corriente. `POLLA_ACCOUNT_ROLES` es el mismo conjunto. `POLLA_ADMIN_ROLES` suma al ADMIN, que opera dentro de su grupo.
  - `POLLA_CREATABLE_TYPES`: nadie crea ADMIN desde Usuarios (nace con su grupo). El superadmin no crea superadmins. El admin crea pasadores y jugadores.
  - `POLLA_PASSWORD_RESET_TARGETS`: el superadmin también blanquea jugadores; el admin, pasadores y jugadores.
- **`polla/types/game.type.ts`**:
  - `IPollaEditionEntityBack.surprise_pool_amount`, `my_load_cutoff` en el front y `pollaTotalPool()`.
  - `IPollaBetEntityBack.is_free` y `repeated_from_bet_id`.
  - `IPollaBetActions` (`can_edit`, `can_delete`) en todas las jugadas listadas, más `IPollaBetPublic.is_free`.
  - `POLLA_HITS_FILTER` (10, 9, 8, 7).
  - `IPollaBetToRepeat` con id, dueño (`user_name`, `holder_type`) y día de carga, más `IPollaRepeatResult` / `IPollaRepeatSkipped`.
  - `IPollaGroupAccountEntityBack`, `IPollaGroupAccountPreview` e `IPollaGroupPendingCashier`.
  - `IPollaTicketCheck.edition` trae `surprise_pool_amount`.
- **`polla/types/catalog.type.ts`**: `IPollaGroupWithAdmin`.
- **`polla/schemas/game.schema.ts`**:
  - El cierre de carga puede ser el mismo día del inicio (`load_limit_date <= start_date`); que sea antes de la hora del turno lo valida la base.
  - `surprise_pool_amount`, `repeatPollaBetsSchema` (hasta `POLLA_REPEAT_MAX_BETS` = 500) y `liquidatePollaGroupSchema`.
- **`polla/schemas/user.schema.ts`**: `newPollaGroupWithAdminSchema` y `assignPollaGroupAdminSchema` (admin existente o nuevo).

### Added - 2026-10-20 (Polla: permisos de cuenta corriente y listado de usuarios)

- **`polla/types/user.type.ts`**:
  - `POLLA_ACCOUNT_ROLES` (dueño, capitalista y superadmin): ven la cuenta corriente, sus reportes y gastos, y liquidan. El ADMIN no. Lo usan los guards de la API y la ruta y el menú de la web.
  - `pollaUserListTypes(role)`: tipos que lista la pantalla de Usuarios (los inferiores, sin el capitalista, que se ve desde Organizaciones).
  - Se saca "liquidan" del comentario de `POLLA_ADMIN_ROLES`.

### Changed - 2026-10-20 (Polla: jugadas borradas en el pase y liquidación por rango)

- **`polla/types/game.type.ts`**:
  - `IPollaBetEntityBack.deducted_on` e `IPollaBetPublic.deducted_on`: día en que la baja se descuenta del pase.
  - `IPollaCurrentAccountEntityBack` e `IPollaCurrentAccountPeriod`: `bets_pass` (Pase jugadas) y `deleted_pass` (Borradas). `pass` es el pase real, base de la comisión.
  - `IPollaCurrentAccountDailyTotals`: `total_bets_pass` y `total_deleted_pass`.
  - Comentario de `IPollaBetPublic.can_delete`: el pasador borra hasta el cierre de carga aunque se haya liquidado.

### Added - 2026-10-15 (Polla: filtro de ediciones por período)

- **`polla/types/game.type.ts`**:
  - `POLLA_EDITION_PERIOD` (`UPCOMING`, `PLAYING`, `FINISHED`) y `POLLA_EDITION_PERIOD_LABEL` (Futuras, Jugando, Pasadas), el filtro `periods` de `GET /edition`.
  - `pollaEditionPeriod(edition, today)`: el período de una edición, con el mismo criterio que el filtro de la API. Lo usa el badge de estado de la pantalla de ediciones.

### Changed - 2026-10-13 (Polla: número por tipo y buscador de pasadores)

- **`polla/types/user.type.ts`**: `IPollaUserOption`, la fila del buscador de pasadores y jugadores (`IPollaUserByNumber` + `username` y `cashier_number`).

### Changed - 2026-10-12 (Polla: cuarta tanda del cliente)

- **`polla/types/game.type.ts`**:
  - `IPollaCurrentAccountPeriod` e `IPollaCurrentAccountPeriodRow`: la fila del día con lo acumulado desde la última liquidación del pasador.
  - Se actualiza el comentario de `IPollaBetPublic.can_delete`: el pasador borra hasta el cierre de carga si su cuenta no se liquidó.
- **`polla/config/session.config.ts`**:
  - `POLLA_EXPORT_PAGE_SIZE` (1000), las páginas del PDF de tickets;
  - `POLLA_ACCOUNT_RECALC_MAX_DAYS` (62), los días que recalcula "Actualizar" y el rango máximo de los filtros de fechas de jugadas.

### Changed - 2026-10-12 (Polla: tercera tanda del cliente)

- **`polla/types/user.type.ts`**: `POLLA_CREATABLE_TYPES` y `POLLA_PASSWORD_RESET_TARGETS` (qué crea y a quién blanquea cada rol), con los helpers `canCreatePollaUser` y `canResetPollaPassword`.
- **`polla/types/game.type.ts`**:
  - `IPollaEditionEntityBack.load_limit_time`.
  - `IPollaBetPublic` pierde `can_edit` (solo un admin edita).
  - Tipos nuevos `IPollaTicketCheck`, `IPollaTicketHolder` e `IPollaTicketWinner` para "Revisar ticket".
- **`polla/schemas/game.schema.ts`**: `load_limit_time` (`HH:mm` o `HH:mm:ss`), obligatorio en el alta de edición y opcional en la edición.

### Changed - 2026-10-06 (Polla: resultados de 2 cifras)

- **`polla/schemas/game.schema.ts`**: los resultados son 20 números de 2 cifras (`^\d{2}$`), los mismos que se comparan con las jugadas. Antes eran de 4 cifras.

### Changed - 2026-10-06 (Polla: segunda tanda del cliente)

- **`polla/types/user.type.ts`**:
  - `POLLA_USER_TYPE_LABEL`: Dueño, Capitalista, Superadministrador, Administrador, Pasador, Jugador.
  - `IPollaUserByNumber`.
  - `credit_balance` sale de `IPollaSessionUser` y de `IPollaUserEntityFront` (ya no hay créditos).
- **`polla/types/game.type.ts`**:
  - `IPollaBetEntityBack.created_by`.
  - `IPollaBetPublic` suma `can_delete` y `amount`.
  - Tipos nuevos: `IPollaDailySales`/`IPollaDailySalesGroup`, `IPollaCurrentAccountDailyTotals` e `IPollaOrgExpenseEntityBack`/`Front`.
  - Se sacan `POLLA_CREDIT_MOVEMENT_TYPE` y los tipos de movimientos de créditos.
- **`polla/types/catalog.type.ts`**: `IPollaOrganizationWithCapitalist`.
- **`polla/schemas/user.schema.ts`**:
  - El número es obligatorio también para el jugador.
  - `updatePollaUserSchema` ya no lleva contraseña.
  - Schemas nuevos: `resetPollaPasswordSchema` y `newPollaOrganizationWithCapitalistSchema`.
  - Se saca `pollaCreditMovementSchema`.
- **`polla/schemas/game.schema.ts`**:
  - Los resultados son exactamente 4 cifras (`0088` es válido); antes se aceptaban 3 o 4.
  - `pollaCurrentAccountUpdateSchema.liquidate`.
  - `newPollaOrgExpenseSchema`.

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
