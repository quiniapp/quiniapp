# Changelog

All notable changes to the Helper workspace are documented in this file.

## [Unreleased]

### Changed - 2026-11-21 (los grupos no tienen pagos)

- **`liquidatePollaGroupEditionSchema`** (`helper/polla/schemas/game.schema.ts`) ya no tiene `payment`: solo `collection` (>= 0). Un `payment` que llegue se descarta (zod no estricto). `IPollaGroupEditionAccountEntity.payments` queda (la base lo sigue devolviendo, siempre en 0).

### Added - 2026-11-20 (estado de la edición en las jugadas)

- **`IPollaBetDerivedFields`** suma `edition_status?: POLLA_EDITION_STATUS` (`helper/polla/types/game.type.ts`), que heredan la jugada de staff y la pública.

### Added - 2026-11-19 (cobros y pagos de grupo)

- **`IPollaGroupEditionAccountEntity`** suma `collections` y `payments`; nueva **`IPollaGroupEditionMovement`** (`helper/polla/types/game.type.ts`).
- **`liquidatePollaGroupEditionSchema`** acepta `collection` y `payment` (>= 0); nuevo **`updatePollaGroupMovementSchema`** (`{ amount > 0 }`) e `IUpdatePollaGroupMovementPayload` (`helper/polla/schemas/game.schema.ts`).

### Changed - 2026-11-18 (el admin ve las liquidaciones de su grupo)

- **`POLLA_PAGE_ROLES.CURRENT_ACCOUNT`** (`helper/polla/config/access.config.ts`) suma `ADMIN`: ve las liquidaciones de su grupo, solo lectura.

### Added - 2026-11-18 (el admin ve las liquidaciones de su grupo)

- **`IPollaGroupEditionLiquidation`** (`helper/polla/types/game.type.ts`): `{ edition, account }`, una liquidación de grupo con su edición.

### Added - 2026-11-18 (parte diario de grupos por rango)

- **`POLLA_GROUP_REPORT_MAX_DAYS`** (`helper/polla/config/session.config.ts`): 62 días como máximo en el parte diario de grupos por rango.

### Added - 2026-11-17 (% del admin de grupo y liquidar varios grupos)

- **`pollaAdminPercentage`** (`helper/polla/schemas/user.schema.ts`): número de 0 a 100, nullable y opcional ("El porcentaje va de 0 a 100"). Lo usan `groupAdmin` (alta del grupo y "Asignar admin") y `updatePollaUserSchema`.
- **`IPollaUserEntityBack.admin_percentage`** y **`IPollaGroupWithAdmin.admin.admin_percentage`**.
- **`liquidatePollaGroupEditionSchema.admin_percentage`** pasa a ser opcional y nullable: si el admin tiene su %, la base usa ese.
- **`liquidatePollaGroupEditionsSchema`** e **`ILiquidatePollaGroupEditionsPayload`**: `{ groups }`, de 1 a `POLLA_GROUP_BATCH_MAX` (200), sin repetidos ("Hay un grupo repetido").

### Added - 2026-11-17 (ZIP de liquidaciones compartido)

- **`helper/functions/liquidationZip.ts`** (nuevo, puro y sin dependencias): las rutas del ZIP de liquidaciones que usan Polla y QuiniApp.
  - `zipFolderName`: saca `\/:*?"<>|` y los puntos o espacios del final.
  - `groupFoldersIfAny`: si alguna hoja tiene grupo, las demás van a la carpeta de sin grupo; si ninguna tiene, no hay carpetas de grupo.
  - `liquidationZipEntries(items, root?)`: arma `raíz/[edición/][grupo/]archivo`, ordenado por edición y grupo, sin repetidos.
  - `zipRootFolder`: el nombre del ZIP sin `.zip`.

### Added - 2026-11-16 (rendimiento SQL — Fase 1: tipos de paginación keyset)

- **`helper/request/pagination.request.ts`**:
  - **`IKeysetPagination` / `IKeysetPaginatedResponse<T>`**: `pageSize`, `hasMore`, `next_cursor` y `totalCount?`, que solo viene en la primera request. Los usa `GET /ticket`.
  - **`IBetsPagination`**: paginación de `GET /bet`. El modo lista usa `next_cursor`; el agrupado, `currentPage` / `totalCount` / `totalPages`.
  - **`IPaginatedBetsResponse<T>`** pasa a usar `IBetsPagination` y ya no extiende `IPaginatedResponse`. Sus `aggregates` quedan en `totalAmount` / `totalPrize`: `totalCount` / `totalWinnersCount` solo los llenaba la búsqueda por ticket y nadie los leía.
  - `IPaginatedResponse<T>` (offset) no cambia: lo sigue usando Polla.

### Added - 2026-11-16 (editar cobros y pagos del historial por fecha)

- **`pollaCurrentAccountPaymentsSchema`** e **`IPollaCurrentAccountPaymentsPayload`** (`helper/polla/schemas/game.schema.ts`): `{ collections, paid }` para `PUT /current_account/:id`. Los dos son obligatorios, ≥ 0 ("El monto no puede ser negativo"), hasta 9.999.999.999,99, el máximo de `NUMERIC(12,2)` ("El monto es demasiado grande"), y con hasta 2 decimales ("El monto tiene hasta 2 decimales").
  - El máximo se controla antes que los decimales: `1e21` se escribe `"1e+21"` y, si no, el primer error sería el de los decimales.
  - Los decimales se miran en el texto del número (`hasAtMostTwoDecimals`), no con `Math.round(v * 100) === v * 100`: en coma flotante `0.29 * 100` da `28.999999999999996` y esa cuenta rechazaría montos válidos como 0,29 o 1,13.

### Added - 2026-11-16 (pollas con la carga abierta en Pollas a liquidar)

- **`IPollaEditionAccountListItem.load_open`** (`helper/polla/types/game.type.ts`): `true` si la carga de la edición todavía no cerró. Con la carga abierta se cargan cobros y pagos, pero no se liquida.

### Changed - 2026-11-15 (lista de ediciones paginada)

- **`IPollaEditionAccountListItem`** (`helper/polla/types/game.type.ts`):
  - `owed` se reemplaza por `owed_by_cashiers` y `owed_to_cashiers`.
  - `cashiers_count`, `liquidated_count` y los dos Debe pueden venir en `null` cuando se piden sin cuenta (`counts=false`).
- **`IPollaEditionAccountListStatus`** (nuevo): `'pending' | 'done'`.

### Added - 2026-11-15 ("Generar liquidación" por edición)

- **`generateEditionLiquidationSchema`** e **`IGenerateEditionLiquidationPayload`** (`helper/polla/schemas/game.schema.ts`):
  - `entries` lleva al menos un pasador y no admite repetidos;
  - `collection` y `payment` son opcionales y ≥ 0; `claim` es opcional y con signo;
  - `ticket_source` es opcional.

### Added - 2026-11-15 (habilitar y deshabilitar usuarios)

- **`setPollaUserDisabledSchema`** (`helper/polla/schemas/user.schema.ts`): `{ disabled }` para `PUT /user/:id/disabled`.
- **`IPollaUserOption`** (`helper/polla/types/user.type.ts`): `disabled` y `cashier_disabled` (jugador con el pasador deshabilitado). Solo aparecen en los buscadores que filtran.
- **`IPollaUserEntityFront`**: `cashier_disabled` opcional (lo trae la lista de usuarios).

### Added - 2026-11-15 (cortesía: dueño, capitalista, superadmin y Súper)

- **`POLLA_COURTESY_ROLES` e `isPollaCourtesyRole`** (`helper/polla/types/user.type.ts`): quién repite de cortesía (superadmin+ y el Súper). Se corrigen los comentarios de `POLLA_SUPER_ROLES`, `POLLA_ADMIN_ROLES` y `POLLA_LOADER_ROLES`, y el de `repeatPollaBetsSchema`.

### Changed - 2026-11-15 (liquidación de grupos: sin ajustes ni pagado)

- **`liquidatePollaGroupEditionSchema`** (`helper/polla/schemas/game.schema.ts`): solo `polla_group_id` y `admin_percentage`; se sacan `adjustments` y `paid`.

### Added - 2026-11-15 (R30: dueño, capitalista, superadmin y Súper cargan hasta el sorteo)

- **`IPollaEditionEntityFront.can_repeat`** (`helper/polla/types/game.type.ts`): si el usuario todavía repite en una edición de Cargar jugada (el Súper, hasta el sorteo; el resto, hasta el cierre). Se corrige el comentario de `my_load_cutoff` (ya no es `null` para superadmin+).
- **`isPollaEditionRepeatable(edition)`**: `false` solo si `can_repeat` es `false`; sin el dato (caché vieja), `true`.

### Changed - 2026-11-14 (la cuenta corriente se liquida por edición)

- **Tipos nuevos (`helper/polla/types/game.type.ts`)**: enum `POLLA_ACCOUNT_MOVEMENT_TYPE` (`COLLECTION`, `PAYMENT`, `CLAIM`) y `POLLA_ACCOUNT_MOVEMENT_LABEL` ("Cobro", "Pago", "Reclamo"). Interfaces `IPollaEditionAccountAmounts`, `IPollaEditionLiquidationRef`, `IPollaEditionAccountRow`, `IPollaEditionAccountMovement`, `IPollaEditionLiquidationAmounts`, `IPollaEditionLiquidationDifference`, `IPollaEditionLiquidationEntity`, `IPollaEditionLiquidationResult`, `IPollaEditionAccountListItem`, `IPollaEditionAccountTotals`, `IPollaUserEditionAccount`, `IPollaGroupEditionAccountEntity` e `IPollaGroupEditionAccountPreview`.
- **Schemas nuevos (`helper/polla/schemas/game.schema.ts`)**: `pollaAccountMovementSchema`, `pollaAccountMovementUpdateSchema`, `liquidateEditionAccountsSchema`, `setEditionLiquidatedSchema` y `liquidatePollaGroupEditionSchema`, con sus tipos de payload.
- **Cambio que rompe:** `newPollaOrgExpenseSchema` ahora exige `polla_edition_id` en lugar de `date`. Los clientes que crean gastos tienen que mandar la edición.

- **`POLLA_ACCOUNT_RECALC_MAX_DAYS`** (`config/session.config.ts`): se corrige el comentario, que seguía describiendo el botón "Actualizar" ya eliminado. La constante sigue en uso como máximo de días de los filtros de fechas.

### Removed - 2026-11-14 (la cuenta corriente se liquida por edición)

- Schemas y tipos sin uso de la escritura por días: `pollaCurrentAccountUpdateSchema`, `pollaCurrentAccountBulkUpdateSchema`, `liquidatePollaGroupSchema`, `IPollaCurrentAccountUpdatePayload`, `ILiquidatePollaGroupPayload`, `IPollaGroupPendingCashier` e `IPollaGroupAccountPreview`.

### Added - 2026-11-11 (R28: orden de las quinielas)

- **Tipos y schemas:**
  - `position` y `label` en las quinielas;
  - `lottery_position` y `lottery_label` en los sorteos y los resultados;
  - `reorderPollaLotteriesSchema`.
- **`pollaDrawLabels`:** arma "1 - Nacional · Nocturna" y ordena por horario del turno y después por posición.

### Added - 2026-11-11 (R29: inicio de carga)

- `IPollaEditionEntityBack.load_start_date` y `load_start_time`.
- `newPollaEditionSchema` y `updatePollaEditionSchema` aceptan `load_start_date` y `load_start_time`, y validan que el inicio sea antes del cierre ("El inicio de carga tiene que ser antes del cierre de carga").

### Added - 2026-11-11 (R33: cortesía una sola vez por ticket)

- `IPollaBetCourtesy` (ticket y edición de la cortesía de un ticket).
- `IPollaRepeatSkipped.courtesy`.

### Added - 2026-11-11 (R19: admin en Premios)

- `IPollaPrize.admin_name`: el admin del grupo del pasador, o `null` si no hay.

### Added - 2026-11-06 (R21: el pasador ve los premios de sus jugadores)

- **`polla/config/access.config.ts`**:
  - La pantalla `PRIZES` suma al admin, al pasador y al jugador.
  - `pollaPrizeScope(user)` dice qué premios ve cada rol (organización, grupo, lo imputado al pasador o lo del jugador) y si ve lo pagado. Un admin sin grupo y el Súper no ven nada.
- `IPollaPrizeList.paid_count`, `paid_amount` y `pending_amount` pueden venir en `null`, que es lo que recibe el jugador.

### Added - 2026-11-06 (R20: premio pagado / no pagado)

- **`polla/types/game.type.ts`**: `IPollaPrize.prize_paid_at` y `prize_paid_by_name`. `IPollaPrizeList` suma `paid_count`, `paid_amount` y `pending_amount`. Nuevo `PollaPrizePaidFilter`.

### Added - 2026-11-06 (R19: sección Premios)

- **`polla/types/game.type.ts`**: `IPollaPrize` e `IPollaPrizeList`.
- **`polla/config/access.config.ts`**: pantalla `PRIZES` (dueño, capitalista y superadmin) y `POLLA_API_ROLES.readPrizes`.

### Changed - 2026-11-06 (R18: premios fuera de la cuenta corriente)

- **`polla/types/game.type.ts`**: comentario de `IPollaCurrentAccountEntityBack.successes`. Es 0 desde el período abierto; los días ya liquidados conservan los suyos.

### Added - 2026-11-05 (R11: el Súper solo carga y administra jugadas)

- **`polla/config/access.config.ts`** (nuevo): la matriz de acceso de Polla.
  - `PollaPage` y `POLLA_PAGE_ROLES`: qué rol ve cada pantalla.
  - `canSeePollaPage`.
  - `pollaHomePage`: Jugadas, o Cargar jugada para el Súper.
  - `POLLA_API_ROLES`: los roles de los endpoints que sirven a una sola pantalla.
  - El Súper ve solo Cargar jugada, Administrar jugadas y Configuración. El resto de los roles no cambia.
- **`polla/types/user.type.ts`**: la etiqueta de ASSISTANT pasa de "Super" a **"Súper"**.

### Added - 2026-11-05 (R10: fecha, hora y estado del ticket para todos)

- **`polla/types/game.type.ts`**: `IPollaBetPublic.created_at`. `PollaBetGameStatus` (`PLAYING` | `WON` | `LOST`), `POLLA_BET_GAME_STATUS_LABEL` ("Jugando", "Ganadora", "No ganó") y `pollaBetGameStatus(bet, editionStatus)`: no ganó cuando su edición terminó sin que ganara.

### Added - 2026-11-05 (R14: borrar tickets impagos de una vez)

- **`polla/types/game.type.ts`**: `IPollaUnpaidSummary` (`count`, `amount`, `winners_skipped`, `cutoff`, `can_delete`).

### Added - 2026-11-05 (R13: marcar tickets en Debe como pagados)

- **`polla/types/game.type.ts`**: `IPollaBetActions.can_mark_paid`. `IPollaBetPublic.payment_status`, que llega solo a quien cobra la jugada.
- **`polla/schemas/game.schema.ts`**: `markPollaBetsPaidSchema` (tickets, o edición + jugador).

### Added - 2026-11-05 (R04: cerrar ticket con Efectivo o Debe)

- **`polla/types/game.type.ts`**: `POLLA_PAYMENT_STATUS` (`PAID`, `OWED`) y `POLLA_PAYMENT_METHOD` (`CASH`), con sus etiquetas ("Pagado", "Debe", "Efectivo"). `IPollaBetEntityBack` suma `payment_status`, `payment_method`, `paid_at` y `paid_by`.
- **`polla/schemas/game.schema.ts`**: `payment_status` opcional en `newPollaBetSchema` y `repeatPollaBetsSchema`.

### Added - 2026-11-05 (R26: polla especial con varios sorteos y mínimo de aciertos)

- **`polla/types/game.type.ts`**:
  - `IPollaEditionDraw` y, en `IPollaEditionEntityBack`, `draws` (los sorteos, ordenados por hora del turno) y `min_winning_hits`. `polla_lottery_id`/`polla_schedule_id` quedan como el sorteo principal.
  - `POLLA_SPECIAL_MIN_HITS_DEFAULT` (8).
  - Para nombrar ediciones: `pollaEditionDraws` (con respaldo al principal), `pollaDrawLabels` / `pollaEditionDrawLabels` ("Nacional · Nocturna" por sorteo), `pollaEditionTitle` (nombre + sorteos separados por coma), `isPollaSpecialEdition` y `pollaPrizeRuleLabel`.
  - `IPollaProcessedEdition` suma `winner_hits`, `min_winning_hits`, `pending_date`, `missing_date` y `missing_draws`. `IPollaTicketCheck.edition` suma `draws` y `min_winning_hits`.
- **`polla/schemas/game.schema.ts`**: `newPollaEditionSchema` pide `draws` (al menos uno, sin repetir) y acepta `min_winning_hits` (entero de 1 a 10); ya no lleva `polla_lottery_id`/`polla_schedule_id`. `updatePollaEditionSchema` acepta los dos opcionales. `definePollaEditionDaySchema` (nuevo).

### Changed - 2026-10-29 (Polla: identificador opcional con jugador y ventas de la edición)

- **`polla/types/game.type.ts`**: `IPollaDailySales.date` puede ser `null` y suma `polla_edition_id` (ventas de toda la edición); `IPollaDailySalesGroup.group_number`. El comentario de `identifier` dice la regla nueva: obligatorio a nombre de un pasador, opcional a nombre de un jugador.
- **`polla/schemas/game.schema.ts`**: comentario de `newPollaBetSchema.identifier` con la misma regla.

### Changed - 2026-10-27 (Polla: números por grupo, tickets nuevos, usuarios de calle y rol Super)

- **`polla/types/user.type.ts`**:
  - `POLLA_USER_TYPE.ASSISTANT` ("Super") y la jerarquía corrida: OWNER 0 · CAPITALIST 1 · SUPERADMIN 2 · ASSISTANT 3 · ADMIN 4 · CASHIER 5 · PLAYER 6.
  - `POLLA_LOADER_ROLES` / `isPollaLoaderRole` (admin+ y el Super: cargan y administran a nombre de otros). `POLLA_STAFF_ROLES` suma al Super.
  - Dueño, capitalista y superadmin crean y blanquean al Super; el Super no crea a nadie.
  - `IPollaUserEntityBack.is_street`, `IPollaUserOption.group_number` / `is_street`, `canBePollaStreetUser` y `pollaCashierCode(grupo, número)` → `"2-5"`.
- **`polla/types/game.type.ts`**: `identifier` en la jugada (también la pública y la de repetir), `group_number` en los campos derivados, `POLLA_BET_IDENTIFIER_MAX` (60), `POLLA_TICKET_SEARCH` (formato nuevo y viejo, compartido por API y web), `pollaTicketCashierCode` y `POLLA_LIQUIDATION_NO_GROUP`. `IPollaTicketHolder.identifier` y `group_number` en el pasador y los ganadores de "Revisar ticket".
- **`polla/types/catalog.type.ts`**: `IPollaGroupEntityBack.number`.
- **`polla/schemas/user.schema.ts`**: `is_street` en el alta (sin usuario ni contraseña; si no es de calle la contraseña es obligatoria) y en la edición, con `password` solo para pasar de calle a aplicación.
- **`polla/schemas/game.schema.ts`**: `newPollaBetSchema.identifier`.

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
