# Changelog 

All notable changes to the API workspace are documented in this file.

## [Unreleased]

### Changed - 2026-10-23 (Polla: Jugadas de solo lectura y Administrar jugadas)

- **`GET /polla/private/bet`** (`polla/bet/route/polla-bet.route.ts`): nuevo parámetro `view`.
  - `view=public` (Jugadas): toda la organización en la versión pública (`toPublicBet`) para todos los roles, admin+ incluido, sin acciones (`can_edit`/`can_delete` en false). No consulta cortes de carga.
  - `view=manage` (Administrar jugadas): `manageScope` pisa los filtros de alcance. El pasador ve lo suyo y lo de sus jugadores (`cashierId`); el admin, su grupo (`groupId`), aunque pida otro; superadmin+, la organización. El jugador recibe 403. `with_free_repeats` solo se calcula acá.
  - `export=true` (PDF de tickets) usa el mismo alcance que `view=manage`.
  - Sin `view` (cuenta corriente) no cambia nada.
  - Sin migración.

### Changed - 2026-10-22 (Polla: grupos con admin, corte por rol, edición de pollas y repetir tickets)

#### Migración `20261021233442_polla_groups_with_admin.sql`
- **Un admin por grupo**: índice único parcial `unique_polla_group_admin_active`.
- **`sync_polla_user_group`** (trigger `trg_sync_polla_user_group`): el jugador toma el grupo de su pasador y solo cambia a otro pasador del mismo grupo (`POLLA_PARENT_OTHER_GROUP`). El grupo del pasador queda fijo desde el alta y el del admin solo se asigna si no tenía (`POLLA_USER_GROUP_LOCKED`). Owner, capitalista y superadmin no van en un grupo. Backfill del grupo de los jugadores existentes.
- **`polla_create_group_with_admin(org, nombre, admin JSONB)`**: crea grupo y admin en una sola transacción, como `polla_create_organization_with_capitalist`.

#### Migración `20261021233443_polla_group_accounts.sql`
- **Tabla `polla_group_accounts`**: una fila por grupo y fecha de liquidación. Guarda lo que dejaron los pasadores (suma de `subtotal` de las filas del grupo), los gastos del grupo, el arrastre, el % y la comisión del admin, el saldo, los ajustes, lo pagado y el total (lo que la organización le debe al admin).
- **`polla_group_pending_cashiers(grupo, fecha)`**: pasadores del grupo con movimientos sin liquidar hasta la fecha (filas calculadas o jugadas que todavía no se calcularon).
- **`polla_group_account_preview(org, grupo, fecha)`**: período desde el día siguiente a la última liquidación del grupo, base = deja de los pasadores − gastos del grupo + arrastre anterior, y pasadores pendientes.
- **`polla_liquidate_group(...)`**: con base positiva la comisión es `base × %` y el arrastre vuelve a 0; si no, no hay comisión y se arrastra. Falla con pasadores pendientes (`POLLA_GROUP_CASHIERS_PENDING`) o si hay una liquidación posterior (`POLLA_GROUP_ACCOUNT_LATER_EXISTS`). Una liquidación de la misma fecha se rehace.
- **`polla_delete_group(grupo, actor)`**: borra el grupo con su admin, pasadores y jugadores y les revoca las sesiones. Lo rechaza con jugadas en ediciones activas (`POLLA_GROUP_HAS_ACTIVE_BETS`), pasadores sin liquidar o un período del grupo sin liquidar (`POLLA_GROUP_ACCOUNT_OPEN`).

#### Migración `20261021233444_polla_cutoffs_editions_repeat.sql`
- **Columnas**: `polla_editions.surprise_pool_amount` (pozo sorpresa), `polla_bets.is_free` (repetida sin cargo) y `polla_bets.repeated_from_bet_id`, con sus índices.
- **Cierre de carga hasta el primer sorteo**: se saca el CHECK `load_limit_date < start_date`. El trigger `validate_polla_edition_load_limit` exige `cierre < inicio + hora del turno`, así que una polla de un día puede cerrar la carga el mismo día (`POLLA_LOAD_LIMIT_AFTER_FIRST_DRAW`).
- **`polla_load_cutoff(edición, rol)`**: única fuente de la regla de corte.
  - Pasador y jugador: fecha y hora de cierre de la edición.
  - Admin: el día de cierre a la hora del turno activo más tarde de la organización (nunca antes que el cierre del pasador) y nunca después del primer sorteo.
  - Superadmin+: sin corte, hasta `end_date`.
- **`polla_can_load`, `polla_loadable_editions`, `polla_editions_load_state`**: se arman sobre `polla_load_cutoff`. `polla_now()` da la hora de Argentina.
- **`polla_create_bet`**:
  - El rol sale del actor; `p_force` queda sin uso para la API del deploy.
  - A nombre de quién carga cada rol: el admin, en su grupo (`POLLA_USER_OTHER_GROUP`); el pasador, a él o a sus jugadores; el jugador, a él (`POLLA_BET_TARGET_FORBIDDEN`).
  - `p_date` solo cuenta para superadmin+.
  - Nuevos `p_free` (amount 0, solo admin+) y `p_repeated_from`.
- **`polla_update_bet_numbers` / `polla_delete_bet`**: el permiso sale de `polla_assert_bet_writable`. Superadmin+ siempre; el admin, en su grupo hasta su corte; el pasador solo borra lo suyo hasta el cierre de carga. El pasador no edita (`POLLA_BET_WRITE_FORBIDDEN`).
- **`polla_repeat_bets(actor, edición, ids, free)`**:
  - Repite tickets a nombre de su dueño original (un jugador, con su pasador actual).
  - Los que no puede repetir vuelven en `skipped` con el motivo (`POLLA_BET_OUT_OF_SCOPE`, `POLLA_SOURCE_EDITION_NOT_FINISHED`, etc.).
  - Sin cargo exige edición fuente `FINISHED` y actor admin+, sin límite de veces.
- **`polla_update_edition(edición, cambios)`**:
  - El precio vale para las jugadas nuevas: cada jugada guarda el suyo.
  - Con ganador solo se renombra (`POLLA_EDITION_HAS_WINNERS_LOCKED`).
  - Con sorteos cargados no cambian quiniela, turno ni inicio (`POLLA_EDITION_DRAWS_LOCKED`), y el fin no puede quedar antes del último sorteo (`POLLA_EDITION_END_BEFORE_DRAW`).
  - Extender una edición `FINISHED` sin ganador la vuelve a `ACTIVE`, salvo que ya se hayan repetido tickets sin cargo desde ella (`POLLA_EDITION_EXTEND_AFTER_FREE_REPEAT`). El solape sigue bloqueado por `no_overlapping_polla_editions`.
- **`polla_process_edition_hits`**: premio = `(pozo + pozo sorpresa) / ganadores`.
- **`polla_daily_sales`**: nuevo `p_group_id` y deja afuera las jugadas sin cargo.

#### Endpoints
- **Grupos (`/group`, nuevo `group/route/polla-group.route.ts`)**:
  - Los arman superadmin, capitalista y dueño. `POST` crea grupo + admin.
  - `POST /:id/admin` asigna a un grupo sin admin uno del modelo anterior o uno nuevo; `GET /admins-without-group` los lista.
  - `DELETE` llama a `polla_delete_group`.
  - El listado trae el admin de cada grupo (solo para superadmin+).
- **Cuenta del grupo (`/group_account`, nuevo)**:
  - `GET /` lista las liquidaciones; el admin ve solo las de su grupo.
  - `GET /previews?date=` muestra lo que se liquidaría a cada grupo, con pasadores pendientes y `liquidated_on_date`.
  - `POST /liquidate` es solo para superadmin+.
- **Middleware**: un ADMIN sin grupo (modelo anterior) recibe 403 en todo menos validar sesión, cambiar contraseña y salir.
- **Usuarios**:
  - El admin lista, crea y edita solo pasadores y jugadores de su grupo. Su pasador queda en su grupo y el jugador cuelga de un pasador del grupo.
  - El grupo no se edita en `PUT /user/:id`.
  - `GET /user/search` lo usan todos para filtrar jugadas. Con `scope=writable` (para cargar a nombre de otro) es solo admin+, y el admin solo busca en su grupo. Acepta `polla_group_id` y `parent_polla_user_id`.
  - `GET /user/by-number` del admin busca solo en su grupo.
- **Jugadas**:
  - Todos ven las jugadas de la organización y filtran por grupo, pasador, jugador, `winner=true|false` y `hits=10,9,8,7`.
  - Cada jugada trae `can_edit` y `can_delete`, calculados con el corte del rol.
  - Nuevos `POST /bet/repeat` (pago), `POST /bet/free-repeat` (admin+) y `GET /bet/mine/last-edition`.
  - `GET /bet/ticket/:n` busca en el alcance del rol y trae el dueño.
  - `with_free_repeats=true` agrega las veces que se repitió sin cargo cada ticket.
  - Ventas: el admin ve solo su grupo.
- **Ediciones**:
  - Crear, editar y borrar es solo para superadmin+.
  - `PUT` usa `polla_update_edition`: se saca el bloqueo del precio con jugadas cargadas y se suma `surprise_pool_amount`.
  - `loadable=true` usa `polla_loadable_editions` y trae `my_load_cutoff`.
  - Los totales (recaudado y cantidad) son solo para superadmin+.
- **Quinielas, turnos y resultados**: escritura solo para superadmin+; el admin lee.
- **`polla-errors.ts`**: mensajes para los códigos nuevos. Si varios matchean, gana el más largo (`POLLA_EDITION_HAS_WINNERS` es prefijo de `..._LOCKED`).

### Changed - 2026-10-21 (Polla: usuarios ordenados por número)

- **`polla-user.repository.ts` → `getAll`** (`GET /user`): sigue agrupado por tipo, pero dentro de cada tipo ordena por `number` de menor a mayor (los que no tienen número al final) y después por nombre. Antes ordenaba por nombre, así que pasadores y jugadores no salían en orden de número.

### Changed - 2026-10-20 (Polla: el admin no ve la cuenta corriente; capitalistas fuera de Usuarios)

- **`polla-current-account.route.ts`**: la cuenta corriente la ven y liquidan solo dueño, capitalista y superadmin (`POLLA_ACCOUNT_ROLES`). El pasador sigue viendo la suya. El ADMIN recibe 403 en `GET /current_account`, `/totals` y `/:id`, y en `calculate`, `liquidate`, `bulk` y `PUT /:id`. Antes podía ver todo y liquidar. El jugador queda afuera por el guard (se borran los chequeos sueltos).
- **`polla-expense.route.ts`**: los gastos (ticket de cobros y pagos) son parte de la cuenta corriente y quedan para `POLLA_ACCOUNT_ROLES`. Antes también entraba el ADMIN.
- **`polla-user.route.ts`**: `GET /user` ya no lista capitalistas, ni pidiéndolos con `user_type=CAPITALIST`: se ven y se administran desde Organizaciones (`pollaUserListTypes`). Crearlos ya estaba bloqueado (`POLLA_CREATABLE_TYPES`).

### Changed - 2026-10-20 (Polla: jugadas borradas en el pase, liquidación por rango y carga de ADMIN+)

#### Migración `20261020212216_polla_deleted_bets_range_admin_load.sql`
- **`polla_bets.deducted_on`** (DATE): día en que la baja de una jugada se descuenta del pase de su pasador. Lo pone solo `polla_delete_bet`. Las bajas anteriores y las jugadas que anula el borrado de una edición quedan en NULL y siguen fuera de la cuenta corriente, como hasta ahora (no se reescribe lo liquidado). Índices parciales `idx_polla_bets_org_deducted_on` e `idx_polla_bets_cashier_deducted_on`.
- **`polla_current_accounts.bets_pass` y `deleted_pass`**: "Pase jugadas" (todo lo cargado ese día, incluidas las que se borraron después) y "Borradas" (lo que se descuenta ese día). `pass` = `bets_pass − deleted_pass + reclamos positivos` y la comisión se calcula sobre ese pase. El día de una baja el pase y la comisión pueden quedar negativos: se revierte lo que ya se liquidó. Backfill: `bets_pass = pass − GREATEST(claims, 0)`.
- **`polla_delete_bet`**: ya no tira `POLLA_BET_DELETE_LIQUIDATED`. El pasador borra lo suyo y lo de sus jugadores hasta el cierre de carga aunque su cuenta ya se haya liquidado: la jugada sigue en el pase de su día de carga (lo liquidado no cambia) y se descuenta hoy, o mañana si su cuenta ya se liquidó hoy. Recalcula la fila del día del descuento y devuelve `deducted_on`. Todas las bajas pasan por la cuenta corriente, también las del mismo período.
- **`polla_calculate_current_account`** y **`polla_update_current_account_recompute`**: arman `bets_pass` y `deleted_pass` con la regla de arriba. Ahora tienen `REVOKE`/`GRANT` a `service_role` como el resto.
- **`polla_recalculate_open_period`**: los días con bajas (`deducted_on`) también se recalculan.
- **`polla_current_account_period_rows`**: nuevo `p_from DATE DEFAULT NULL`. Con `p_from` el período es `[p_from, p_date]` (liquidación por rango); sin él, cada pasador sigue arrancando el día siguiente a su última liquidación. `period` suma también `bets_pass` y `deleted_pass`. El saldo anterior es el del primer día, así que `saldo anterior + subtotal − cobros + pagos = total`.
- **`polla_current_account_daily_totals`**: agrega `total_bets_pass` y `total_deleted_pass`.
- **`polla_create_bet`**: con `p_force` (ADMIN y superiores) no hay cierre de carga: cargan mientras la edición esté `ACTIVE` y hasta su último día de juego (`polla_today() > end_date` → `POLLA_LOAD_LIMIT_EXCEEDED`). Con la polla en juego, los aciertos de los sorteos ya procesados no se suman solos: hay que volver a generar los ganadores de esos días. Pasador y jugador siguen con fecha y hora de cierre.

#### Endpoints
- **`GET /bet`**:
  - `with_deducted=true`: suma a las activas las borradas que siguen en el pase de jugadas de su día (los tickets del período cuadran con "Pase jugadas").
  - `deducted_from` / `deducted_to`: solo las borradas que se descuentan en ese rango (cuenta como filtro que acota el listado).
  - Los dos son de la liquidación: el jugador recibe 403 y el pasador ve solo lo imputado a él.
  - `IPollaBetPublic` trae `deducted_on`.
- **`DELETE /bet/:id`**: devuelve `deducted_on`. `can_delete` del pasador ya no mira la liquidación (sí que la jugada no esté borrada).
- **`GET /current_account?date=&range_from=`** y **`POST /current_account/calculate|liquidate`** con `range_from`: montos del rango `[range_from, date]` (hasta 62 días, `range_from <= date`, si no 400). Liquidar sigue marcando `date`, que es el Hasta.
- **`GET /edition?loadable=true`**: para ADMIN y superiores filtra `end_date >= hoy` (`adminLoadableOn`) en lugar de `load_limit_date`.

#### Otros
- `PollaCurrentAccountRepository.getLastLiquidatedDate` se borra: quedó sin uso. `POLLA_BET_DELETE_LIQUIDATED` se deja en `polla-errors.ts` para la RPC anterior durante el deploy.

### Added - 2026-10-15 (Polla: filtro de ediciones por período)

- **`GET /edition?periods=`**: lista separada por coma de `UPCOMING`, `PLAYING` y `FINISHED` (`POLLA_EDITION_PERIOD`). Lo usan los checkboxes "Futuras / Jugando / Pasadas" de la pantalla de ediciones; se filtra en la base para que el scroll infinito pagine bien.
  - `UPCOMING`: `ACTIVE` con `start_date` posterior a hoy.
  - `PLAYING`: `ACTIVE` con `start_date` hasta hoy. Sigue acá pasado `end_date` hasta que se procesa el resultado y queda `FINISHED`.
  - `FINISHED`: cerradas, con ganador o sin ganador.
  - "Hoy" es `pollaToday()` (Argentina, del servidor). Los valores se validan contra el enum (otro valor → 400 "Período inválido"), así que en el `or` de PostgREST no entra texto del cliente.
  - Sin `periods`, o con los tres, no filtra.
- **`PollaEditionRepository.getAll`**: filtro `periods` (`{ list, today }`), con un único `or` y una condición por período.

### Changed - 2026-10-14 (Polla: los admin cargan hasta el final del día de cierre)

- **Migración `20261014225307_polla_admin_load_until_end_of_day.sql`**: `polla_create_bet` con `p_force` (ADMIN y superiores) ya no saltea el cierre. Carga hasta el final del día `load_limit_date` (`polla_today() > load_limit_date` → `POLLA_LOAD_LIMIT_EXCEEDED`), sin mirar `load_limit_time`.
  - Ejemplo: si la edición cierra el viernes 16/10 a las 12:00, pasadores y jugadores cargan hasta esa hora y los admin hasta el viernes a las 23:59:59 (hora de Argentina). Antes los admin podían cargar en cualquier momento.
  - `p_force` conserva el nombre para que la API anterior siga funcionando durante el deploy.
  - Editar y borrar jugadas no cambia: con force, el admin sigue pudiendo pasado el cierre.
- **`GET /edition?loadable=true`**: para ADMIN y superiores filtra solo por fecha (`load_limit_date >= hoy`). Para pasador y jugador sigue mirando fecha y hora.
- **`polla-errors.ts`**: `POLLA_LOAD_LIMIT_EXCEEDED` dice "Cerró la carga de esta edición", sin "(fecha y hora de cierre)", porque para los admin el cierre es solo la fecha.

### Changed - 2026-10-14 (Polla: buscador de usuarios por número)

- **`GET /user/search`**: ordena por número (`number` ascendente, sin número al final). Si un pasador y un jugador comparten número, el pasador va primero.
  - Antes salían todos los pasadores y después los jugadores. El desplegable de la web se lee como una lista por número.
- **`GET /user?search=`** (listado de Usuarios): solo dígitos busca el número exacto. Otro texto sigue buscando con `ilike` en nombre, apellido y usuario.
- **`helper/search.ts`**: `searchNumber` decide cuándo lo escrito es un número. Lo usan `PollaUserRepository.getAll` y `search`.

### Changed - 2026-10-13 (Polla: número por tipo y buscador de pasadores)

#### Número de usuario único por tipo
- **Migración `20261013221747_polla_user_number_per_type.sql`**: `unique_polla_user_number_active` pasa a ser `(polla_organization_id, user_type, number)`.
  - Un pasador y un jugador pueden compartir número; dos jugadores (o dos pasadores) de la misma organización, no.
  - El índice conserva el nombre, así que `polla-errors.ts` lo sigue traduciendo. El mensaje de respaldo ahora dice "para ese tipo de usuario".
  - No necesita backfill: los números ya eran únicos por organización.
- **`polla-user.route.ts`**: alta y edición chequean el número antes de guardar (`PollaUserRepository.isNumberTaken`). Si está ocupado devuelven 409 "Ese número de jugador ya está en uso" (o "de pasador").
- **`GET /user/by-number/:number`**: si el número lo comparten un pasador y un jugador devuelve 409 "buscalo por nombre", en vez de un 500. La web nueva usa el buscador; queda para la web vieja durante el deploy.

#### Buscador de pasadores y jugadores
- **`GET /user/search`** (ADMIN y superiores): `q` y `user_type` (separados por coma, solo `CASHIER`/`PLAYER`), paginado.
  - Solo dígitos busca el número exacto; otro texto busca con `ilike` en nombre, apellido y usuario; vacío trae todos.
  - Orden: pasadores primero, después por número.
  - Cada fila trae `cashier_name`/`cashier_number`: el pasador del jugador, o el propio pasador.
- **`PollaUserRepository.search`**: embebe al pasador por columna (`parent:parent_polla_user_id(...)`). Con `polla_users!parent_polla_user_id` PostgREST trae los jugadores del pasador.
- **`helper/search.ts`** (nuevo): `ilikeTerm`/`ilikeAny` arman el patrón entre comillas dobles, así `,`, `(` o `)` escritos por el usuario no rompen el `.or()`.
  - El `search` de `GET /user` lo usa también: deja de interpolar el texto crudo y suma el apellido.

### Changed - 2026-10-12 (Polla: cuarta tanda del cliente)

#### Borrado de jugadas por el pasador
- **Migración `20261012210905_polla_cashier_delete_until_load_limit.sql`**: `polla_delete_bet` sin force deja de exigir que la jugada sea del día.
  - El pasador borra lo suyo y lo de sus jugadores mientras la carga de la edición siga abierta (fecha y hora de cierre). Con la polla en juego la carga ya cerró.
  - Si su cuenta ya se liquidó el día de carga o después, devuelve `POLLA_BET_DELETE_LIQUIDATED` y solo un admin puede borrarla.
- **`polla-errors.ts`**: error nuevo `POLLA_BET_DELETE_LIQUIDATED` (403).
- **`polla-bet.route.ts`**: `can_delete` del pasador sigue la misma regla.
  - Usa el cierre de carga de cada edición, con el nuevo `PollaEditionRepository.getLoadLimits` y `isPollaLoadOpen` en `helper/date.ts`.
  - Usa la última liquidación del pasador, con el nuevo `PollaCurrentAccountRepository.getLastLiquidatedDate`.

#### Cuenta corriente por período (liquidación semanal)
- **Migración `20261012210906_polla_current_account_period.sql`**: las filas diarias no cambian. Se suman dos funciones:
  - **`polla_current_account_period_rows`**: devuelve las filas de un día. Cada una trae en `period` lo acumulado desde el día siguiente a la última liquidación del pasador:
    - pase, aciertos, reclamos, comisión, deja, subtotal, cobros y pagos;
    - saldo anterior al inicio del período;
    - total a la fecha.
  - **`polla_recalculate_open_period`**: recalcula todos los días con movimiento del período abierto más viejo de la organización, hasta 62 días hacia atrás. Después vuelve a encadenar los saldos. Así entran los días que nunca se calcularon.
  - Índice parcial `idx_polla_current_accounts_liquidated`.
- **`polla-current-account.route.ts`**:
  - `GET /current_account?date=` devuelve las filas con `period`. Con `from`/`to` no cambia.
  - `POST /calculate` recalcula el período abierto.
  - `POST /liquidate` recalcula y marca el día como liquidado para todos, lo que cierra sus períodos.
  - `PUT /:id` con `liquidate` recalcula el período antes de liquidar.
- **`PollaCurrentAccountRepository`**: `getPeriodRows`, `recalculateOpenPeriod`, `markDayLiquidated` y `getLastLiquidatedDate`. Sale `calculate`, que quedó sin uso.
- **`GET /bet`**: filtros nuevos `load_from`/`load_to` y `hit_from`/`hit_to`, de hasta 62 días. Son los tickets y ganadoras del período que se liquida.

#### PDF de tickets
- **`GET /bet?export=true`**: páginas de hasta 1000 jugadas (`POLLA_EXPORT_PAGE_SIZE`) con el keyset que ya existía.
  - Exige una edición.
  - El jugador recibe 403, porque no imprime.
- **`helper/pagination.ts`**: `parsePagination(query, maxLimit)`.

### Changed - 2026-10-12 (Polla: tercera tanda del cliente)

#### Alcance por organización
- **`helper/scope.ts`**: todos los roles, OWNER incluido, operan solo sobre su organización. Pedir otra devuelve 403, y `resolveOptionalOrganizationId` ya no devuelve "todas" para el OWNER.
- Se sacan las excepciones del OWNER en jugadas, catálogos, cuenta corriente, ediciones, resultados y usuarios. El OWNER sigue administrando las organizaciones (y el capitalista de cada una) desde `/organization`.

#### Usuarios y contraseñas
- **`polla-user.route.ts`**:
  - El alta usa `canCreatePollaUser`. Superadmin, capitalista y OWNER crean jugadores eligiendo el pasador; el trigger valida que sea un pasador activo de la organización.
  - El blanqueo exige `canResetPollaPassword(actor, objetivo)` y rechaza blanquearse a uno mismo:
    - el OWNER blanquea capitalistas (vía Organizaciones) y a todos los de su organización;
    - el capitalista, a los de su organización;
    - el superadmin, a admin y pasador;
    - el admin, a pasadores;
    - el pasador, a sus jugadores.
  - `GET /user/by-number/:number` es solo ADMIN+ y busca pasadores y jugadores.
- **`polla-auth.repository.ts`**: el blanqueo deja la contraseña definitiva (`password_reset_required = false`). Sigue destrabando la cuenta y cerrando las sesiones.
- **`POST /auth/change-password`**: solo responde mientras `password_reset_required`, que hoy solo puede tener el OWNER del seed con la contraseña inicial publicada en el repositorio. El resto recibe 403.
- **Migración `20261012012417_polla_definitive_passwords.sql`**: las contraseñas temporales pendientes pasan a definitivas, salvo la del OWNER del seed si sigue con la contraseña inicial.

#### Grupos
- **`polla-catalog.route.ts`**: los grupos los crean, renombran y borran solo OWNER y capitalista. La lectura sigue abierta a todos.

#### Jugadas
- **`polla-bet.route.ts`**:
  - Editar es solo ADMIN+. Eliminar: ADMIN+, o el pasador sobre lo suyo o lo de sus jugadores. El jugador recibe 403 en las dos.
  - `can_edit` sale de la vista pública y `can_delete` es solo para el pasador.
  - Pasador y jugador cargan únicamente a su nombre (se saca la carga del pasador a nombre de sus jugadores).
  - `date` solo se toma de un ADMIN+: antes un pasador o un jugador podía mandar una fecha anterior y saltear el cierre de carga.
  - `GET /bet/check/:ticketNumber` (staff, solo la propia organización): devuelve `IPollaTicketCheck`, con la jugada, el titular (pasador, o jugador y su pasador), la edición con su pozo y los ganadores con su premio.
- **`polla-bet.repository.ts`**: `getForCheck`, y un helper `ticketPattern` (ticket completo o prefijo de 17 dígitos) que comparte con `getByTicketNumber`.

#### Hora de cierre de carga
- **Migración `20261012012416_polla_edition_load_limit_time.sql`**:
  - columna `polla_editions.load_limit_time TIME NOT NULL DEFAULT '23:59:59'` (las ediciones existentes conservan el cierre a fin de día);
  - función `polla_load_closed(date, time)` con la hora de Argentina;
  - `polla_create_bet`, `polla_update_bet_numbers` y `polla_delete_bet` controlan el cierre por fecha y hora (sin `p_force`).
- **`polla-edition.route.ts`/`repository`**: filtro `loadable=true` (carga abierta ahora, con fecha y hora del servidor). `loadable_on` sigue aceptándose.
- **`helper/date.ts`**: `pollaNowTime()`.
- **`polla-errors.ts`**: `POLLA_LOAD_LIMIT_EXCEEDED` → "Cerró la carga de esta edición (fecha y hora de cierre)".

### Changed - 2026-10-06 (Polla: resultados de 2 cifras)

- **Migración `20261006140000_polla_results_two_digits.sql`**:
  - Los resultados se cargan con 2 cifras (00 a 99) y se comparan tal cual con los números jugados. Antes se cargaban 4 cifras y el procesamiento se quedaba con las 2 últimas.
  - Los resultados ya cargados se pasan a sus 2 últimas cifras, que es lo mismo que usaba el procesamiento: no cambia ningún acierto.
  - Trigger `validate_polla_result_numbers`: cada resultado tiene que tener 2 cifras (`POLLA_RESULTS_INVALID`).
  - `polla_process_edition_hits` compara cada resultado sin `RIGHT()`.
- **`polla-result.route.ts`**: se saca el recorte a 2 cifras para pasador y jugador, porque todos los resultados ya tienen 2 cifras.

### Fixed - 2026-10-06 (Polla: pase inflado por ediciones borradas)

- **Causa del pase de $20.000 con 4 jugadas (develop):** borrar una edición solo le ponía `deleted_at` a la edición. Sus jugadas seguían vivas y `polla_calculate_current_account`, que suma por pasador y día, las contaba en el pase. Walter tenía el 05-10 un pase de $22.000: 1 jugada de la edición vigente y 10 de dos ediciones de prueba borradas.
- **Migración `20261006130000_polla_delete_edition_voids_bets.sql`**:
  - `polla_delete_edition(edition, actor)`: borra la edición, anula sus jugadas y recalcula la cuenta corriente de cada pasador y día afectado (`polla_refresh_current_account_row`). No borra una edición con ganadores (`POLLA_EDITION_HAS_WINNERS`).
  - Arreglo de datos: anula las jugadas que quedaron vivas en ediciones ya borradas (con la fecha de borrado de su edición) y recalcula sus cuentas. En develop, Walter pasa de $22.000 a $2.000 y Pasador Prueba de $6.000 a $2.000 el 05-10.
- **`polla-edition.route.ts`**: `DELETE /edition/:id` usa la RPC y devuelve `voided_bets`.

### Changed - 2026-10-06 (Polla: segunda tanda del cliente)

#### Jugadas sin créditos, fechas de Argentina y cuenta corriente al día
Cada pasador cobra las jugadas por fuera de la aplicación, así que dejan de existir los créditos.
- **Migración `20261006120000_polla_bets_without_credits.sql`**:
  - `polla_today()`: fecha de negocio en Argentina. El servidor y la base corren en UTC, y una jugada cargada después de las 21 caía en el día siguiente.
  - `polla_create_bet` ya no debita créditos. El número de ticket usa la hora de Argentina (igual que QuiniApp) y el día por defecto es `polla_today()`. Guarda quién cargó la jugada en la columna nueva `polla_bets.created_by`.
  - `polla_delete_bet` ya no devuelve créditos. Sin `force` (pasador o jugador) solo borra jugadas cargadas hoy (`POLLA_BET_DELETE_ONLY_SAME_DAY`): borrar una de un día anterior cambiaría una liquidación ya hecha.
  - `polla_update_bet_numbers` controla el límite de carga con `polla_today()`.
  - `polla_refresh_current_account_row(cashier, date, org)`: si la cuenta corriente del día ya estaba calculada, alta y baja de jugadas la recalculan para ese pasador y arrastran el saldo. Antes el pase quedaba con las jugadas que había al calcular (por ejemplo, $20.000 de pase con 4 jugadas de $2.000 después de borrar otras).
  - `REVOKE`/`GRANT` a `service_role` en todas las funciones recreadas.
- **Migración `20261006120100_polla_player_numbers.sql`**: pasadores y jugadores necesitan número (`CHECK polla_users_number_required`), porque se los busca por número para cargarles jugadas. A los que ya existían sin número se les asignan los siguientes libres de su organización.
- **Migración `20261006120200_polla_sales_and_current_account_reports.sql`**:
  - Índice `idx_polla_bets_org_load_date`.
  - `polla_daily_sales(org, date, cashier?)`: boletas y monto del día por grupo.
  - Tabla `polla_org_expenses`: gastos de la organización o de un grupo por día. Es la de `org_expenses` de QuiniApp.
  - `polla_current_account_daily_totals(org, from, to, group?, user?)`: totales por día de la cuenta corriente, con gastos y `net_balance` (cobros − pagos − gastos).
- **Migración `20261006120300_polla_organization_with_capitalist.sql`**: `polla_create_organization_with_capitalist` crea la organización y su capitalista en una sola transacción. Si el usuario está repetido, no queda la organización.
- **Errores**: `POLLA_BET_DELETE_ONLY_SAME_DAY` y `polla_users_number_required`. Se sacan los de créditos.
- **`helper/date.ts`**: `pollaToday()`, la fecha de Argentina para Node. `polla-bet.repository.create` la usa por defecto en vez de la fecha UTC.

#### Usuarios
- **`polla-user.route.ts`**:
  - Solo un pasador crea jugadores: cualquier otro rol recibe 403 "Solo un pasador puede crear jugadores".
  - `POST /user/:id/reset-password`: blanqueo con contraseña temporal. Obliga a cambiarla al entrar, levanta el bloqueo y cierra las sesiones (`PollaAuthRepository.resetPassword`).
  - `GET /user/by-number/:number`: pasador o jugador por número para cargarle una jugada. ADMIN+ busca en su organización y el pasador entre sus jugadores.
  - `PUT /:id` no cambia la contraseña (se usa el blanqueo). El pasador no puede cambiar la comisión ni el pasador de un jugador.
  - Se sacan `/me/credits` y `/:id/credits`, y los métodos de créditos del repositorio.
- **Sesión**: `credit_balance` sale de `/auth/validate`, login y refresh.

#### Jugadas
- **`polla-bet.route.ts`**:
  - Carga a nombre de otro: ADMIN+ para cualquier pasador o jugador de la organización, y el pasador para sus jugadores.
  - Borrado: el pasador también puede borrar las jugadas imputadas a él (las de sus jugadores), siempre que sean del día. La proyección pública suma `can_delete` y `amount` (este último solo en las propias).
  - `GET /bet/last`: la última jugada que cargó el propio usuario, para "Repetir última jugada".
  - `GET /bet/sales?date=`: ventas del día. ADMIN+ recibe el total y el desglose por grupo; el pasador, solo lo suyo; el jugador recibe 403.
  - Filtros `load_date` y `hit_date` para todos los roles. Con alguno de los dos ya no hace falta elegir edición (para la liquidación).
- **`polla-edition.route.ts`**: no deja cambiar `ticket_price` si la edición ya tiene jugadas. Las jugadas guardan el precio con el que se cargaron, y cambiarlo desfasa el pase.

#### Resultados
- **`polla-result.route.ts`**: pasador y jugador reciben los resultados con las 2 últimas cifras. ADMIN+ recibe las 4.

#### Organizaciones
- **`organization/route/polla-organization.route.ts`** (nuevo; reemplaza al router genérico de catálogos para organizaciones):
  - `GET` devuelve cada organización con su capitalista.
  - `POST` crea la organización con su capitalista.
  - `PUT` cambia el nombre y `DELETE` la borra.
  - `POST /:id/capitalist/reset-password` blanquea la contraseña del capitalista.
  - Todas las escrituras son solo del OWNER.

#### Cuenta corriente y gastos
- **`polla-current-account.route.ts`**:
  - Filtro `user_number`.
  - `GET /totals?from&to&polla_group_id` (el pasador recibe solo los suyos).
  - `PUT /:id` acepta `liquidate: true` para marcar la fila como liquidada.
- **`expense/route/polla-expense.route.ts`** (nuevo, ADMIN+): `GET ?date&polla_group_id`, `POST` y `DELETE /:id` de gastos, montado en `/expense`.

### Changed - 2026-10-05 (Polla: ajustes del cliente)

#### Números repetidos y aciertos por casillero con fecha
Una jugada puede repetir números (el 32 cinco veces) y cada aparición necesita su propia salida a lo largo de la edición: las 5 en un mismo sorteo o repartidas entre varios días. Antes los números tenían que ser distintos y los aciertos se guardaban sin fecha, así que no había forma de corregir un sorteo mal cargado.
- **Migración `20261005120000_polla_repeated_numbers_hit_dates.sql`**:
  - El trigger `validate_polla_bet_numbers_distinct` se reemplaza por `validate_polla_bet_numbers`, que solo valida el formato `^\d{2}$`.
  - Columna nueva `polla_bets.hit_dates DATE[]`, en paralelo a `numbers`: día en que acertó cada casillero, o NULL. `hits` y `hit_numbers` pasan a ser derivados (`hit_numbers` ahora incluye repetidos). El backfill le pone a cada casillero ya acertado el primer sorteo de la edición en que salió su número. No cambia ningún `hits`, `winner`, `prize` ni estado de edición.
  - `polla_process_edition_hits` reescrita. Reprocesar el día D libera solo los casilleros marcados con D y los reasigna con los resultados actuales de D, contando repeticiones dentro del sorteo. Si el resultado se borró, D queda sin aciertos. Las marcas de otros días no se tocan. Los ganadores se derivan de las marcas: una jugada se completa el día de su último acierto y gana quien se completó primero. Así, corregir un resultado que había generado un ganador lo revierte y reabre la edición. También procesa ediciones `FINISHED` cuyo ganador es de D o posterior. Devuelve además `winner_date`, `previous_winner_date` y `reopened`.
  - `polla_process_results_and_accounts` recorre las ediciones del turno que cubren el día, no los resultados cargados, así un resultado borrado también limpia sus aciertos. Recalcula la cuenta corriente de D y de los días ganadores viejo y nuevo, y arrastra el saldo con `polla_cascade_current_account_from_date`.
  - `polla_update_bet_numbers` también limpia `hit_dates`.
  - Índices: se crea `idx_polla_bets_edition_ranking (polla_edition_id, hits DESC, created_at DESC, polla_bet_id DESC)` para el ranking con keyset. Se dropean `idx_polla_bets_edition_hits` (cubierto) e `idx_polla_bets_edition_pending` (el procesamiento ya no filtra por `winner = FALSE`).
- **`polla-errors.ts`**: se quita `POLLA_NUMBERS_NOT_DISTINCT`.

#### Liquidación sin deje
- **Migración `20261005120100_polla_settlement_without_leave.sql`**: `fee_plus = 0` para todos los pasadores. Con eso las funciones existentes dejan `drag` y `leave` en 0; el historial no se toca.
- **`polla-user.route.ts`**: el alta de un pasador guarda `fee_plus = 0` y la edición ignora `fee_plus`.
- **`polla-current-account.route.ts`**: `calculate`, `liquidate` y la edición por fila calculan siempre con `calculateLeave = false` y `leaveInSubtotal = false`. Los parámetros `leave` y `leave_in_subtotal` se ignoran.

#### Privilegios por rol (como QuiniApp)
- **`polla-bet.route.ts`**:
  - Pasadores y jugadores reciben de cada jugada una proyección pública (`toPublicBet`): grupo, pasador, cliente, números, `hit_dates`, aciertos, estado, más `is_mine` y `can_edit`. No reciben ids internos ni montos; el premio solo viene si la jugada ganó. Admin+ recibe la fila completa.
  - El jugador ya no ve las jugadas anónimas: ve el nombre del jugador y del pasador. Si la jugada es del pasador, `client_name` va en `null`.
  - `mine=true`: el pasador ve las imputadas a él (las suyas y las de sus jugadores) y el jugador, las propias. La búsqueda por `ticket_number` queda habilitada para todos.
  - `sort=hits|recent`, por defecto `hits` (ranking), con cursor keyset de tres niveles (`hits|created_at|id`) validado igual que el de dos.
  - `GET /ganadores` usa la misma proyección.
- **`polla-bet.repository.ts`**: el grupo viaja embebido (`polla_groups(name)`) y cada fila suma `group_name` y `client_name`.
- **`polla-edition.route.ts`**: `bets_count` y `collected_amount` (totales) solo se le mandan a admin+.

#### Repetir ticket
- **`GET /api/polla/private/bet/ticket/:ticketNumber`**: devuelve `{ ticket_number, polla_edition_id, numbers }`. Acepta el número completo, o los 17 dígitos sin `-<pasador>` (búsqueda por prefijo, como QuiniApp). Admin+ busca en la organización, el pasador en lo imputado a él y el jugador en lo propio.

#### Tema por usuario
- **Migración `20261005120200_polla_user_theme.sql`**: `polla_users.theme` (`'light' | 'dark'`, por defecto `'light'`).
- **`PUT /api/polla/private/auth/preferences`** (cualquier rol): guarda el tema y devuelve el usuario de sesión. `theme` se suma a `/auth/validate`, login y refresh.

### Fixed - 2026-10-04 (Borrado de archivo y tamaño de base)

#### "Borrar datos" fallaba por statement timeout
`cleanup_old_archive_data` borraba en un solo `DELETE` todo lo de `bets_archive`/`tickets_archive` con más de 65 días. Con meses acumulados superaba el `statement_timeout` de PostgREST (`canceling statement due to statement timeout`), y antes de eso el proxy de Vercel ya cortaba el POST a los 4s y devolvía `BACKEND_UNAVAILABLE`.
- **Migración `20261004100730_cleanup_archive_batched_and_db_size_view.sql`**: reemplaza la función por `cleanup_old_archive_data_batch(p_days, p_batch_size)`, que borra un lote por llamada (primero las apuestas y, cuando ya no quedan apuestas viejas, los tickets) y devuelve `{ cutoff_date, bets_deleted, tickets_deleted, done }`. Es el mismo patrón que `archive_data_by_date`. Solo `service_role` tiene `EXECUTE`.
- **`src/settings/`**: `POST /api/private/settings/cleanup` ahora borra **un lote** (5000 filas, 65 días) y responde con el resultado de ese lote. El cliente repite hasta que llega `done: true`. **Cambio incompatible**: la respuesta ya no trae `success` y suma `done`.

#### `total_storage_view` medía de menos
Sumaba solo las tablas de `public` y dejaba afuera auth, storage, otros esquemas y los catálogos. Ahora usa `pg_database_size(current_database())`, que es el tamaño contra el que se aplica el límite del plan de Supabase. Las columnas (`total_bytes`, `total_mb`, `total_gb`) no cambian. Ojo: después de borrar filas, Postgres no achica los archivos (el espacio queda libre para reusar), así que el número no baja enseguida.

### Changed - 2026-09-28 (Polla se separa de QuiniApp)

#### La Polla pasa a ser un sistema propio sobre el mismo deploy de backend
La Polla estaba embebida en QuiniApp: cada jugada era un `tickets` del sistema principal, dependía de sus usuarios, catálogos y tenant, y no había lugar para el rol *jugador*. Ahora es un sistema paralelo con esquema `polla_*`, autenticación propia y su propio frontend (`polla-web/`). Se reutiliza únicamente el proceso Express y la base Supabase.

**El tenant es el capitalist**: una fila de `polla_organizations` = un capitalist, con sus propias quinielas, turnos, usuarios, ediciones, resultados, pozo y liquidación. Dentro de una organización no hay separación: todos ven todas las jugadas (el jugador, anonimizadas); grupo y pasador son filtros, no permisos. Solo el OWNER cruza organizaciones.

- **Migraciones nuevas** (`api/supabase/migrations/`):
  - `20260928100000_polla_drop_legacy.sql`: restaura `generate_winners_and_calculate_accounts` sin la rama de Polla y dropea las tablas, funciones y el tipo de la Polla vieja. Los tickets que generó quedan intactos (ya estaban liquidados).
  - `20260928100100_polla_core_tables.sql`: `polla_organizations`, `polla_groups` (tabla real, no la sub-organización de QuiniApp), `polla_users` (jerarquía `OWNER → CAPITALIST → SUPERADMIN → ADMIN → CASHIER → PLAYER`, con `parent_polla_user_id` para colgar un jugador de su pasador y `credit_balance`), `polla_sessions`, `polla_lotteries` y `polla_schedules`. Triggers que validan que el padre de un jugador sea un CASHIER activo de la misma organización y que el grupo pertenezca a esa organización.
  - `20260928100200_polla_game_tables.sql`: `polla_editions` (con contadores denormalizados `bets_count`/`collected_amount` y `EXCLUDE USING gist` por organización + quiniela + turno + rango de fechas), `polla_results` (carga manual, único por organización), `polla_bets` (sin tabla de tickets: `ticket_number` propio, `cashier_polla_user_id` para la imputación y organización/grupo/nombres denormalizados), `polla_credit_movements` (ledger con `balance_after`) y `polla_current_accounts`.
  - `20260928100300_polla_indexes.sql`: índices parciales que calcan los predicados exactos, incluido el compuesto `(polla_edition_id, created_at DESC, polla_bet_id DESC)` que sirve la paginación keyset del feed, y los dos de liquidación `(cashier_polla_user_id, load_date)` y `(cashier_polla_user_id, hit_date) WHERE winner`. `ANALYZE` al cierre.
  - `20260928100400_polla_functions.sql`: `polla_adjust_credits`, `polla_create_bet` (debita créditos al jugador y le imputa la jugada al pasador padre), `polla_update_bet_numbers`, `polla_delete_bet` (devuelve créditos), `polla_process_edition_hits` (acumulación set-based; solo toca ediciones `ACTIVE` que cubran la fecha, así una edición ya ganada no vuelve a calcularse), `polla_calculate_current_account` (misma fórmula que `calculate_current_account`, con pases y premios tomados directo de `polla_bets`), `polla_update_current_account_recompute`, `polla_cascade_current_account_from_date` y el orquestador `polla_process_results_and_accounts`.
  - `20260928100500_polla_seed_owner.sql`: organización de sistema + usuario OWNER (`owner` / `polla2026`, con `password_reset_required = TRUE`). **Cambiar la contraseña en el primer login.**
  - `20260928100600_fix_polla_create_bet_credit_link.sql`: `polla_create_bet` enlaza el movimiento de crédito con la jugada usando el id que devuelve `polla_adjust_credits`, en vez de buscar "el último movimiento BET sin jugada" del jugador (con dos cargas simultáneas del mismo jugador esa subconsulta podía elegir el movimiento de la otra).
- **Módulo nuevo `api/src/polla/`**: auth propia (cookies `polla_access_token`/`polla_refresh_token`, secretos `POLLA_JWT_SECRET_*` derivados de los de QuiniApp si no se definen), `middleware/` con `isPollaAuthenticated` y un `requirePollaRole(...)` genérico (QuiniApp hace estos chequeos inline en cada router), y los módulos `catalog` (router genérico para organizaciones, grupos, quinielas y turnos), `user` (ABM + créditos), `edition`, `bet`, `result` y `current-account`. Montado en `/api/polla` (público) y `/api/polla/private` (autenticado), registrado **antes** que QuiniApp porque Express matchea por prefijo en orden de registro.
- **Todos los `getAll` paginados**: `page`/`limit` (default 50, máximo 200) con el envelope `IPaginatedResponse` existente; el `COUNT` exacto se pide solo en la primera página y el feed de jugadas acepta además `cursor` (keyset).
- **Visibilidad server-side**: el jugador recibe una proyección recortada (sin nombres, sin pasador, sin organización) salvo en sus propias jugadas y en las ganadoras, y sus filtros se ignoran en el backend. ADMIN y superiores pueden editar o borrar jugadas incluso pasada la fecha límite (`p_force`).
- **Módulos eliminados**: `api/src/polla-edition/` y `api/src/polla-bet/`, y sus rutas en `api/src/router.ts`.
- **`api/.env.example`**: documenta `POLLA_JWT_SECRET_ACCESS`, `POLLA_JWT_SECRET_REFRESH`, `POLLA_JWT_ACCESS_EXPIRATION` y `POLLA_JWT_REFRESH_EXPIRATION` (todos opcionales).


### Added - 2026-09-20 (Juego Polla)

#### Nuevo juego de pozo compartido: Polla
Primer juego del sistema con pozo compartido entre varios ganadores (hasta ahora todo el modelo era premio fijo por apuesta individual). El jugador elige 10 números de 2 cifras (00-99); se juega día a día entre `start_date` y `end_date` de una edición contra los resultados de una quiniela+turno; gana quien primero acumula 10 aciertos (pueden ser varios el mismo día, reparten el pozo en partes iguales).

- **Migraciones nuevas** (`api/supabase/migrations/`):
  - `20260920100000_create_polla_tables.sql`: tablas `polla_editions` (config de una edición: quiniela, turno, `start_date`/`end_date`/`load_limit_date`, `pool_amount`, `ticket_price`, `status`) y `polla_bets` (una jugada = un ticket; `numbers`/`hit_numbers`/`hits` acumulados día a día, datos del pasador denormalizados para no depender de que el ticket de carga siga existiendo). Constraint `EXCLUDE USING gist` (requiere `btree_gist`) evita ediciones con fechas solapadas para la misma quiniela+turno. RLS habilitado en ambas tablas (el backend usa `service_role` y no se ve afectado).
  - `20260920100100_create_polla_bet_rpc.sql`: RPC `create_polla_bet` — cada jugada de 10 números genera su propio ticket (nunca se mezcla con jugadas de quiniela normal), con `total = ticket_price` de la edición.
  - `20260920100200_process_polla_hits.sql`: RPC `process_polla_edition_hits`/`process_polla_editions_for_schedule_date` — acumulan aciertos día a día comparando las 2 últimas cifras de los 20 resultados del día contra los números de cada jugada activa. Al llegar a 10 aciertos, reparte el pozo en partes iguales entre las jugadas ganadoras de ese día y cierra la edición; si se llega a `end_date` sin ganador, la edición queda `FINISHED` sin repartir (el admin decide manualmente sumar el sobrante al pozo de la próxima edición).
  - `20260920100300_hook_polla_into_generate_winners.sql`: engancha el procesamiento de Polla dentro de `generate_winners_and_calculate_accounts`, entre `generate_winners` y `calculate_current_account` — sin tocar ningún archivo TypeScript, `POST /winners/:id?date=` ya dispara todo.
  - **Liquidación**: el pase se imputa el día de carga (ticket normal, ya lo capta `calculate_current_account` de ese día). El premio se paga con un **ticket nuevo** dado de alta el día que se determina el ganador (no retroactivo al día de carga) para que quede incluido en la misma liquidación diaria junto a los demás premios.
- **Módulos nuevos**: `api/src/polla-edition/` (CRUD admin de ediciones, no-CASHIER) y `api/src/polla-bet/` (carga y consulta de jugadas), registrados en `api/src/router.ts` como `/polla_edition` y `/polla_bet`.
- `20260920100400_polla_bet_edit_delete.sql`: soft-delete (`polla_bets.deleted_at/deleted_by`) + RPCs `update_polla_bet_numbers`/`delete_polla_bet` — admin/owner puede editar los 10 números o borrar una jugada mientras no haya pasado `load_limit_date` de la edición y la jugada no sea ganadora (borrar también soft-elimina el ticket asociado). `process_polla_edition_hits` actualizado para ignorar jugadas borradas. Rutas `PUT/DELETE /polla_bet/:id` (no-CASHIER).
- `20260920100500_add_ticket_number_to_polla_bets.sql`: denormaliza `ticket_number` en `polla_bets` (igual que `user_id`/`user_name`) para poder mostrarlo/reportarlo sin JOIN a `tickets`.
- `PollaBetRepository.getAll` acepta `lottery_id`/`schedule_id`/`date` para resolver automáticamente qué ediciones de Polla están vigentes ese día — usado por la pantalla "Jugadas y Aciertos" del frontend para listar también las jugadas de Polla.

### Added - 2026-07-19 (Backdated tickets)

#### `ticketBase` honra la fecha enviada para roles no-cajero
- **`api/src/ticket/helper/ticketBase.ts`**: nueva opción `{ allowCustomDate }`. Cuando es `true` y el `date` del payload cumple `YYYY-MM-DD` (`dateRegex` de helper) y no es futuro (comparado contra hoy en `America/Argentina/Buenos_Aires`), se persiste esa fecha en `date`; en cualquier otro caso se fuerza hoy (comportamiento previo). `created_at` y `ticket_number` siguen generándose SIEMPRE con el timestamp real de creación (rastro de auditoría).
- **`api/src/ticket/controller/ticket.controller.ts`**: `create` pasa `allowCustomDate: !isCashier` — un cajero nunca puede backdatear aunque manipule el payload; defensa en profundidad respecto del guard de UI.
- Sin migración SQL: la RPC `create_ticket_with_bets` ya insertaba `(ticket->>'date')::date`; el server era quien la pisaba.

### Added - 2026-07-19 (Log Sanitization)

#### Sensitive data redaction in error logs (ISO 27001 A.8.15 / A.8.12)
- **`api/src/utils/sanitize-log.ts`** — `sanitizeForLog()` deep-copies any value replacing fields whose key contains `password`, `token`, `secret`, `authorization`, `cookie` or `refresh` (case-insensitive) with `[REDACTED]`. Tests in `sanitize-log.test.ts` (node:test, 6 cases).
- **`api/src/middlewares/error.middleware.ts`** — the error handler now passes `req.body`, `req.params` and `req.query` through `sanitizeForLog` before logging. Previously a failed login logged the plaintext password in the request body.

### Added - 2026-07-18 (Schema Cleanup)

#### Migration `20260718213215_schema_cleanup_indexes_types.sql`
Part 2 of the schema audit (out-of-scope items from the security hardening migration).
- **Dropped 16 redundant indexes**: exact duplicates (`idx_sessions_refresh_token_hash` vs the UNIQUE constraint, `idx_bets_archive_bet_id`/`idx_tickets_archive_ticket_id` vs their PKs), prefixes of wider composite indexes (`idx_bets_schedule_date`, `idx_bets_organization_id`, `idx_bets_user_id`, `idx_tpt_date`, `idx_tpt_date_schedule`, `idx_schedule_lotteries_org_day`, `idx_schedule_lotteries_organization_id`, `idx_schedule_lotteries_org_schedule`, `idx_results_lottery_id`, `idx_results_schedule_id`, `idx_users_username_active`), and low-selectivity boolean indexes (`idx_bets_paid`, `idx_sessions_is_active`). Reduces write amplification on `bets`/`tickets`.
- **Type consistency**: `schedules.created_at/edited_at` converted from `timestamp` to `timestamptz` (values reinterpreted as UTC; JSON output now carries an explicit offset); `bets.prize`, `bets_archive.prize`, `tickets.total_prize`, `tickets_archive.total_prize` converted from bare `numeric` to `numeric(12,2)` to match the other money columns.
- **Dropped legacy `users.password` column** — replaced by `password_hash` long ago; the API only touches `password_hash`. The migration aborts with an exception if any row still holds a non-empty value.
- **Fixed `hard_delete_organization`** — it failed on organizations with expenses (`fk_org_expenses_organization` is `ON DELETE RESTRICT`) because it never deleted `org_expenses`; it also left orphan rows in `bets_archive`/`tickets_archive` (no FK on `organization_id` there). Both now deleted explicitly.

### Added - 2026-07-18 (Security Hardening)

#### Migration `20260718153406_security_hardening_revoke_grants.sql`
Findings from full schema audit of the develop database dump (pre-migration to the new Supabase project). The API talks to the database only with the `service_role` key, so nothing here affects the backend.
- **RLS enabled** on `org_expenses`, `analytics_client_stats`, `analytics_device_stats` — they were the only tables without it while being granted to `anon` (readable/writable through the Data API with the anon key).
- **Dropped `process_bets()`** — legacy winners calculation, no organization awareness, wrong loop bounds for `place = TWENTY` (1..10 instead of 1..20) and REDOUBLE multipliers inconsistent with `calculate_redouble_payout`. Superseded by `generate_winners`.
- **Dropped `pay_ticket(text, uuid)`** — legacy overload without organization filter; `ticket_number` is unique per org, so it could pay another org's ticket.
- **Fixed `pay_ticket(text, uuid, uuid)`** — restored `FOR UPDATE` (lost vs. the legacy version) to serialize concurrent payment attempts; also pinned `search_path`.
- **Pinned `search_path` on `create_ticket_with_bets`** — it is `SECURITY DEFINER` and was the only one without it (search-path hijack risk).
- **Revoked all privileges** on tables/sequences/functions in `public` from `anon` and `authenticated`, plus `EXECUTE` from `PUBLIC` (blocks anon-key RPC calls to `SECURITY DEFINER` functions like `hard_delete_organization`). Default privileges reset so future objects are not auto-granted.

### Added - 2026-06-27 (High Availability)

#### Backup backend / transparent failover (Railway main + Render backup)
- **Health endpoints** — `api/src/health/health.route.ts` (mounted in `api/src/index.ts` before
  auth/csrf/rate-limit/logging):
  - `GET /health` — shallow liveness `{ status, instance, uptime }`. Used by the keep-warm pinger
    and uptime monitors. Reachable directly on the backend host, not only via the Vercel proxy.
  - `GET /health/deep` — verifies Supabase connectivity (cheap `SELECT`), returns 200/503.
- **Job gating** — `api/src/index.ts`: singleton jobs (archive cron + session cleanup) now run only
  when `ENABLE_BACKGROUND_JOBS=true`, so the passive backup doesn't double-execute them. Per-instance
  flush jobs (session monitor + device stats) keep running on every instance so each persists the
  buffer of requests it served (matters when the backup serves traffic during a failover).
- **Keep-warm job** — `api/src/utils/keep-warm.job.ts`: the main instance pings the backup's `/health`
  every 10 min (gated by `ENABLE_BACKGROUND_JOBS`, no-op when `BACKUP_HEALTH_URL` unset) to keep
  Render's free tier from sleeping.
- **New envs** — `api/envs.ts` + `.env.example`: `INSTANCE_NAME` (default `main`),
  `ENABLE_BACKGROUND_JOBS` (default `true`), `BACKUP_HEALTH_URL` (optional).
- **Production start script** — `api/package.json`: added `start: tsx src/index.ts` (no compiled
  dist/ exists and the project uses tsconfig path aliases, so tsx is the runtime, same as dev).
- **Deploy** — `render.yaml` (repo root): free-tier web service for the backup with
  `ENABLE_BACKGROUND_JOBS=false`. **Requires identical JWT secrets, Supabase config and cookie
  settings as Railway** so sessions survive the switch.

### Changed - 2026-05-16 (Rate Limiting)

#### Rate Limit Tuning — CGNAT tolerance
- **`api/src/config/rate-limit.config.ts`**: Adjusted hard caps and slow-down thresholds to prevent false positives for users sharing IPs via CGNAT
  - PRIVATE hard cap: 2000 → 5000 / 5 min (was 15 min)
  - PUBLIC hard cap: 2000 → 3000 / 5 min (was 15 min)
  - LOGIN slow-down: 5 req/5s → 20 req/30s (wider window for fast typers)
  - PUBLIC slow-down: 40 req/10s → 60 req/10s
  - Why: lottery agencies in same ISP area share the same public IP (CGNAT); previous limits triggered disconnections under concurrent normal usage

### Fixed - 2026-05-16

#### Current Account
- **Leave in subtotal drag bug**: When `p_leave_in_subtotal = TRUE`, drag was incorrectly recalculated as `prev_drag + subtotal` (where subtotal already had leave deducted), reducing the drag carry-over by the leave amount
  - Fix: drag always stored as `prev_drag + revenue` regardless of `p_leave_in_subtotal`; only `subtotal` absorbs the leave deduction
  - Migration: `api/supabase/migrations/20260516140000_fix_leave_in_subtotal_drag.sql`
  - Functions fixed: `update_current_account_recompute`, `calculate_current_account`

### Added - 2026-05-16

#### Current Account
- **Leave in subtotal**: New `leave_in_subtotal=true` query param on `PUT /api/private/current_account/:id`
  - When enabled: stores `subtotal = revenue - leave` and `drag = prev_drag + revenue` (leave absorbed in subtotal only)
  - Total changes because subtotal changes; drag carries full revenue forward to subsequent days
  - RPC: `update_current_account_recompute` updated with `p_leave_in_subtotal` param
  - Files: `api/src/current-account/route/current-account.route.ts`, `controller/current-account.controller.ts`, `repository/current-account.repository.ts`

### Added - 2026-05-16 (Security)

#### CSRF Protection
- **CSRF middleware**: `api/src/middlewares/csrf.middleware.ts` — validates `X-Requested-With: XMLHttpRequest` on all state-changing requests (POST/PUT/PATCH/DELETE)
  - Returns 403 `FORBIDDEN` if header is absent
  - Safe methods (GET/HEAD/OPTIONS) bypass the check
  - Applied globally in `api/src/index.ts` after `cookieParser()`
- **Hard-cap rate limiters**: Added permissive `express-rate-limit` alongside slow-down to satisfy CodeQL `js/missing-rate-limiting`
  - Limits: login 100/15min, auth 500/15min, public/private 2000/15min
  - All configurable via env vars (`RATE_LIMIT_*_MAX`)
  - Files: `api/src/config/rate-limit.config.ts`, `api/src/middlewares/rate-limit.middleware.ts`, `api/src/index.ts`

### Changed - 2026-05-16

#### Auth
- **Rate Limiting**: Replaced all rate limiters with silent slow-down middleware (`express-slow-down`)
  - Removed: `loginRateLimiter`, `authRateLimiter`, `publicApiRateLimiter`, `privateApiRateLimiter`
  - Added: slow-down per tier (login: 5 req/5s → 5s delay; auth: 15 req/10s → 3s; public: 40 req/10s → 2s; private: 80 req/10s → 2s)
  - Files: `api/src/config/rate-limit.config.ts`, `api/src/middlewares/rate-limit.middleware.ts`, `api/src/index.ts`
- **Account Lockout**: Removed account locking on failed password attempts
  - Wrong password no longer increments failed attempt counter or locks account
  - Users can enter wrong password unlimited times without any block
  - Removed: `MAX_FAILED_ATTEMPTS`, `LOCKOUT_DURATION` from `session.config.ts`
  - Files: `api/src/auth/controller/auth.controller.ts`, `api/src/config/session.config.ts`

### Changed - 2026-05-02

#### Liquidación Individual — campos manuales expandidos

- **`api/src/current-account/controller/current-account.controller.ts`**: `AllowedManualKeys` ahora incluye `pass`, `successes`, `drag`, `revenue`. El payload de `updateCurrentAccountHandler` pasa estos campos al RPC si vienen en el request.
- **`api/supabase/migrations/20260502120000_update_rpc_manual_override_pass_successes_drag_revenue.sql`**: RPC `update_current_account_recompute` acepta overrides manuales para `pass` (reemplaza cálculo desde tickets), `successes` (reemplaza premios desde tickets), `revenue` (reemplaza subtotal calculado), `drag` (reemplaza cálculo por fee_plus). Si no vienen en `p_props`, el comportamiento anterior se mantiene.
### Fixed - 2026-05-06

#### Archive tickets — jugadas no cargaban en terminal-ticket para tickets viejos

- **`api/src/bet/repository/bet.repository.ts`** — `getAllBets()`: Al buscar el `ticket_id` por `ticket_number`, ahora usa `getTableName(date, 'tickets')` para consultar `tickets_archive` cuando la fecha es antigua. Antes siempre consultaba `tickets`, retornando `null` para tickets archivados y por ende 0 jugadas. También cambia `.single()` por `.maybeSingle()` para evitar error cuando no existe.

### Fixed - 2026-05-06

#### Archive tickets — `bet_order` faltante en RPC y pago desde archivo

- **`api/supabase/migrations/20260506120000_fix_archive_rpc_bet_order.sql`**: Actualiza `ticket_full_json_plpgsql_archive` para incluir `bet_order` en cada bet del JSON (igual que la versión regular desde `20260102194200`). También alinea el `DISTINCT ON` a `(ticket_id, bet_order, schedule_id, lottery_id)`. Sin el `bet_order`, el modal de repetir ticket asignaba la clave `"undefined"` a todas las apuestas y solo guardaba la primera.
- **`api/supabase/migrations/20260506120001_add_pay_ticket_archive.sql`**: Nueva función `pay_ticket_archive(p_ticket_number TEXT, p_user_id UUID, p_organization_id UUID)`. Misma lógica que `pay_ticket` pero opera sobre `tickets_archive` y `bets_archive`. Permite pagar tickets ganadores archivados (> 2 días).
- **`api/src/ticket/repository/ticket.repository.ts`** — `payTicket()`: Si `pay_ticket` RPC lanza `TICKET_NOT_FOUND`, reintenta con `pay_ticket_archive` antes de propagar el error. Así el fallback es transparente para el caller.
- **`api/src/ticket/controller/ticket.controller.ts`** — `paid()`: Eliminado el try/catch roto que bloqueaba el pago de tickets archivados con error `TICKET_ARCHIVED`. El repository ahora maneja el fallback internamente.

### Added - 2026-04-30

#### Cuenta Corriente — recálculo en cascada de días posteriores

- **`api/supabase/migrations/20260430120000_rpc_cascade_current_account_from_date.sql`**: Nueva función `cascade_current_account_from_date(p_from_date_text TEXT, p_organization_id UUID, p_user_id UUID DEFAULT NULL)`. Cuando se actualiza un día pasado, propaga el nuevo `total` y `drag` hacia todos los días siguientes del usuario (o todos los usuarios de la org si `p_user_id` es NULL), actualizando `previous_balance`, `previous_drag`, `total`, `drag` y `leave` (si estaba calculado) en cascada.
- **`api/src/current-account/repository/current-account.repository.ts`**: Nuevo método `cascadeCurrentAccountFromDateHandler(organization_id, date?, user_id?)` que llama al RPC `cascade_current_account_from_date`.
- **`api/src/current-account/controller/current-account.controller.ts`**: `calculateCurrentAccountHandler` llama a cascade después de calcular (scope: todos los usuarios de la org). `updateCurrentAccountHandler` llama a cascade para el usuario específico cuyo registro fue editado. `calculateCurrentAccountNetworkHandler` llama a cascade para cada org en la red.
- **Why**: Al cargar reclamos, pagos o cobros de un día pasado (ej: viernes) en fecha posterior (ej: sábado), el `saldo anterior` del sábado quedaba desactualizado. Ahora cualquier modificación propaga automáticamente el nuevo saldo hacia los días siguientes.

### Fixed - 2026-04-23

#### Archive RPC — statement timeout + single-batch loop
- **`api/src/archive/service/archive.service.ts`**: `archiveOldData` now loops per date until `bets_remaining + tickets_remaining = 0`, passing `p_batch_size: 500` per call. Previous code called the RPC once per date with default batch 5000, which exceeded PostgREST's ~8 s statement timeout on large days.

#### Archive RPC — ambiguous function overload
- **`api/supabase/migrations/20260423061747_drop_archive_data_by_date_single_param.sql`**: Drops `archive_data_by_date(DATE)` left over from migration `20260415`. Migration `20260422` added a two-param overload `(DATE, INTEGER DEFAULT 5000)` with a different signature so Postgres kept both. RPC calls with only `p_date` got "could not choose best candidate function" error. Removing the old overload leaves only the batch-size version.

### Added - 2026-04-21

#### Org Expenses — soporte de grupo

- **`api/supabase/migrations/20260421095647_add_group_id_to_org_expenses.sql`**: Añade columna `group_id TEXT DEFAULT NULL` a `org_expenses`.
- **`api/src/org-expense/repository/org-expense.repository.ts`**: `getByOrgAndDate` filtra por `group_id` (o IS NULL si no se pasa). `create` acepta `group_id`.
- **`api/src/org-expense/controller/org-expense.controller.ts`**: Pasa `group_id` a repository en get y create.
- **`api/src/org-expense/route/org-expense.route.ts`**: Lee `group_id` de query (GET) y body (POST).

### Added - 2026-04-20

#### Cuenta Corriente — endpoint daily-summary
- **`api/src/current-account/repository/current-account.repository.ts`**: Added `getDailySummaryByDateRange` — queries `current_accounts` for all CC fields (pass, successes, claims, subtotal, previous_balance, collections, paid, total, drag, leave), aggregates per date.
- **`api/src/current-account/controller/current-account.controller.ts`**: Added `getDailySummaryByDateRangeHandler` delegating to repository.
- **`api/src/current-account/route/current-account.route.ts`**: Added `GET /daily-summary?date_from&date_to&group_id` — same auth/group scoping as `/totals`. Returns `{ data: { summary: DailySummaryEntry[] } }`.

### Fixed - 2026-04-20

#### Session Management
- **Version mismatch on login**: `signRefreshToken` at login now uses `refresh_token_version + 1` to match the version stored by `rotateRefreshToken`, fixing first-refresh 401 failures that caused users to be logged out every ~13-14 minutes (`api/src/auth/controller/auth.controller.ts`)

### Fixed - 2026-04-19

#### Concurrency and race condition hardening
- **`api/src/auth/controller/auth.controller.ts`**: Check `token_version` from JWT against DB before bcrypt hash comparison. Concurrent refreshes from multiple tabs no longer trigger false `token_reuse_detected` → `revokeAllUserSessions`. Also replaced TOCTOU `countActiveSessions + revokeOldestSession + create` with single `createWithLimit` RPC call.
- **`api/src/auth/repository/auth.repository.ts`**: Removed racy SELECT+UPDATE fallback in `incrementFailedAttempts`. Failed login count is now always atomic via the `increment_failed_attempts` RPC.
- **`api/src/session/cache/session-activity.cache.ts`**: Added `restore()` method for max-timestamp-wins re-merge.
- **`api/src/session/job/session-monitor.job.ts`**: Re-merge activity snapshot back to cache on DB flush failure — prevents mass session expiry on transient Supabase errors.
- **`api/src/session/repository/session.repository.ts`**: Added `createWithLimit()` using `create_session_with_limit` RPC for atomic concurrent-session enforcement.
- **`api/supabase/migrations/20260419100000`**: `batch_update_session_activity` now uses `GREATEST()` to prevent timestamp regression under concurrent flushes from multiple server instances.
- **`api/supabase/migrations/20260419100001`**: `pay_ticket` adds `SELECT ... FOR UPDATE` before UPDATE to serialize concurrent payment attempts and prevent double side-effects.
- **`api/supabase/migrations/20260419100002`**: `create_session_with_limit` RPC initial implementation (contained invalid `SELECT COUNT(*) ... FOR UPDATE` — fixed in 20260419192947).
- **`api/supabase/migrations/20260419192947`**: Fix `create_session_with_limit` — replace invalid `FOR UPDATE` on aggregate with `pg_advisory_xact_lock(hashtext('create_session:' || user_id))`. PostgreSQL does not allow `FOR UPDATE` with aggregate functions; advisory lock serializes concurrent logins for the same user atomically.
- **`api/supabase/migrations/20260419100003`**: `calculate_current_account` acquires `pg_advisory_xact_lock(org:date)` to serialize concurrent bulk liquidations from shared admin accounts.

### Fixed - 2026-04-18

#### Ticket number uniqueness scoped to organization + cashier number suffix
- **Root cause**: `UNIQUE (ticket_number)` was global — different organizations (or different cashiers in same org) creating tickets at the same millisecond caused false unique constraint violations.
- **Fix**: `ticket_number` generation in `api/src/ticket/helper/ticketBase.ts` now appends the cashier's `number` as suffix (e.g. `20260418143025123-42`), making same-org same-millisecond collisions impossible in practice.
- **`helper/request/ticket.request.ts`**: Added `user_number?: number | null` to `INewTicketEntity` — frontend sends cashier's number (handles case where admin creates on behalf of cashier: `cashier?.number ?? user!.number`).
- **`web/src/features/make-plays/provider/MakePlaysProvider.tsx`**: Both payloads include `user_number: cashier?.number ?? user!.number`.
- **`api/src/ticket/helper/ticketBase.ts`**: Uses `ticket.user_number` from the payload to build suffix with dash (format `YYYYMMDDHHmmssSSS-{N}`).
- **`api/supabase/migrations/20260418203053`**: Also drops `ticket_number_numeric_only` constraint and replaces it with `ticket_number_format CHECK (ticket_number ~ '^\d+(-\d+)?$')` to allow the dash-separated suffix.
- **`api/supabase/migrations/20260418203053_fix_unique_ticket_number_per_org.sql`**: Drops global constraint, adds `UNIQUE (ticket_number, organization_id)`.

### Added - 2026-04-16

#### Totales por rango de fechas en Cuenta Corriente
- **`api/src/current-account/repository/current-account.repository.ts`**: Nuevo método `getTotalsByDateRangeHandler(organization_id, date_from, date_to, user_ids?)` — query GROUP BY date sobre `current_accounts` dentro de un rango, con soporte de filtro por `user_ids` (grupos) y red de organizaciones
- **`api/src/current-account/controller/current-account.controller.ts`**: Nuevo método `getTotalsByDateRangeHandler` que delega al repositorio
- **`api/src/current-account/route/current-account.route.ts`**: Nuevo endpoint `GET /totals` con query params `date_from`, `date_to`, `group_id` (opcional). Auto-scope a grupo para ADMIN con grupo asignado. Acceso: todos excepto CASHIER

### Fixed - 2026-04-15

#### Ticket lookup always returning NOT_FOUND
- **Root cause**: `TicketController.get` checked `ticket.organization_id !== organization_id` after calling `repository.getById`, but neither `ticket_full_json_plpgsql` nor `ticket_full_json_plpgsql_archive` include `organization_id` in their JSONB output. So `ticket.organization_id` was always `undefined`, the check always failed, and every ticket ID lookup returned "Ticket no encontrado".
- **Fix**: Removed the redundant check in `api/src/ticket/controller/ticket.controller.ts`. Both RPCs already filter `WHERE ticket_id = p_ticket_id AND organization_id = p_organization_id` in SQL, so any result is already scoped to the correct org.
- **Introduced by**: commit `9a4a007` (feat: implement smart archive query routing system)

### Changed - 2026-04-15

#### Archive job: day-by-day processing
- **Root cause fixed**: archive job was failing because a single `archive_old_data` SP call processed 1.2M+ rows in one transaction, hitting Supabase's `statement_timeout`. The TS fallback also failed because `.delete().in('bet_id', ids)` with 5000 UUIDs exceeded HTTP URL length limits.
- **New approach**: TypeScript fetches distinct dates to archive (`get_dates_to_archive` RPC), then loops oldest-to-newest calling `archive_data_by_date(date)` per day. Each call is scoped to one day's data so it never approaches the timeout.
- **New migration** `20260415080624_archive_by_date.sql`:
  - Drops `archive_old_bets(INTEGER)`, `archive_old_tickets(INTEGER)`, `archive_old_data(INTEGER)`
  - Adds `get_dates_to_archive(p_cutoff_date DATE)` — returns `DATE[]` of distinct dates with data before the cutoff
  - Adds `archive_data_by_date(p_date DATE)` — archives bets then tickets for that date in one transaction, returns `{date, bets_archived, tickets_archived}`
- **`archive.service.ts`**: rewrote `archiveOldData` to loop by day with per-day try/catch; breaks on first failure and reports which date failed. Removed TS manual fallback (`archiveOldBetsManual`, `archiveOldTicketsManual`, `archiveOldDataManual`).
- **`cron.service.ts`**: updated result logging to show per-day breakdown and totals.

### Added - 2026-04-14

#### Ticket Idempotency
- **client_request_id column**: Added nullable UUID column with partial unique index to `tickets` table (`migrations/20260414090510_add_client_request_id_to_tickets.sql`)
- **RPC update**: `create_ticket_with_bets` now accepts optional `p_client_request_id UUID` — returns existing ticket on duplicate key using `ON CONFLICT ... DO NOTHING` instead of inserting again (`migrations/20260414090511_sp_create_ticket_idempotency.sql`)
- **Repository**: `TicketRepository.create` passes `p_client_request_id` to the RPC
