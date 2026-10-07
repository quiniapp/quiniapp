# Changelog 

All notable changes to the API workspace are documented in this file.

## [Unreleased]

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
