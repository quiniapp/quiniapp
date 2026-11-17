# Plan de rendimiento SQL — QuiniApp y Polla

> Conceptos: `docs/rendimiento-sql-conceptos.md` (Winand; las referencias `§n` apuntan a ese documento).
> Mediciones: `docs/rendimiento-sql-baseline.md`. Reglas permanentes: sección *SQL Performance* de `CLAUDE.md`.

## Estado

| Fase | Rama | Estado |
|---|---|---|
| 0 Reglas en CLAUDE.md + baseline | `perf/sql-0-baseline` | Lista: reglas, scripts, baseline local y de prod. Falta el delta de `pg_stat_statements` (T0/T1) para reordenar las Fases 2–7 |
| 1 Keyset jugadas/tickets QuiniApp + totales rotos | `perf/sql-1-keyset-quiniapp` | Pendiente |
| 2 RPC agrupadas y totales | `perf/sql-2-grouped-rpc` | Pendiente |
| 3 Polla: ticket y keyset | `perf/sql-3-polla-ticket-keyset` | Pendiente (baja prioridad: en prod `polla_bets` tiene ~340 filas) |
| 4 Polla: listados con offset | `perf/sql-4-polla-offset` | Pendiente (baja prioridad, ídem) |
| 5 Round-trips | `perf/sql-5-round-trips` | Pendiente |
| 6 Limpieza de índices y RPC viejas | `perf/sql-6-cleanup` | Pendiente (≥1 semana después del deploy a prod) |
| 7 Bugs detectados + fix de CLAUDE.md | `fix/sql-7-pendientes` | Pendiente |

**Candidatos fuera del plan original** (del baseline de prod; se suman como fase nueva si el delta los confirma): `generate_winners_and_calculate_accounts` (~1 s por llamada, máx. 18 s, la ve el usuario al cargar resultados) y `archive_data_by_date` (costo de mantener los índices de `bets_archive`). Detalle en `docs/rendimiento-sql-baseline.md`.

## Hallazgos (relevamiento de código; verificados contra HEAD `4fc63db`)

| Dónde | Problema | § |
|---|---|---|
| `api/src/bet/repository/bet.repository.ts` `getAllBets` | `.range()` (offset) + `count: 'exact'` en todas las páginas; `select('*, lotteries(*), schedules(*)')`; orden `created_at DESC, bet_order ASC` sin desempate único. Medido: el costo es el **sort** del día completo de la organización bajo el `LIMIT` (390 ms en página 1, sort en disco en páginas profundas), no el count (10 ms) | 7, 4, 10.12 |
| `api/src/ticket/repository/ticket.repository.ts` `getAll` | Offset + count exacto en todas las páginas, `select('*')`, orden solo por `created_at` (no determinista) | 7 |
| Índices `bets` / `tickets` | Ninguno entrega `(organization_id, date)` + orden del listado | 2.6, 6 |
| `bets_archive` | Ningún índice empieza por `organization_id`: entra por `date` y filtra organización (medido: 25k filas descartadas por página) | 2.6, 3 |
| `getAllBets` con `ticket_number` | Round-trip extra a `tickets` cuando `bets.ticket_number` ya existe e indexado | 4 |
| `get_grouped_bets_for_parse` / `_count` | Lógica inteligente `(p IS NULL OR …)`: entran por `idx_bets_date` (todas las organizaciones). Página 1 de agrupadas = 4 RPC ≈ 590 ms | 2.11, 3 |
| `polla-bet.repository.ts` `ticketFilter` | `LIKE 'n-%' OR LIKE '%-n-%'`: comodín inicial → seq scan de todo `polla_bets` | 2.7 |
| `polla-bet.repository.ts` `afterCursor` | Keyset como OR puro: el índice no se acota (10k–37k filas descartadas en un cursor profundo; con row values, 0) | 7 |
| `withDeducted` y cuentas por edición | `(deleted_at IS NULL OR deducted_on IS NOT NULL)` no coincide con ningún índice parcial | 2.9 |
| Índices de `polla_bets` | 16 índices; `hits` está en dos (`edition_ranking` y `edition_hits`) | 8 |
| Round-trips | Cascade de cuenta corriente por organización, `PUT /bulk` uno por id, `getAmountsByTicket` en 3 queries | 3, 4 |

## Contexto

Los listados de QuiniApp y Polla tienen problemas de rendimiento: OFFSET + `count: 'exact'` en cada página, RPC con "lógica inteligente" `(p IS NULL OR col = p)`, LIKE con comodín inicial en Polla e índices solapados que encarecen INSERT/UPDATE. Este plan se ejecuta por fases, con una rama y un PR a `develop` cada una.

Objetivo: que el tiempo de cada listado dependa de N (tamaño de página) y no del volumen del día o de la edición, con menos round-trips y menor costo de escritura, **preservando todos los totales que la UI muestra junto a listados paginados**.

Decisiones tomadas:
- El baseline de prod lo corre el responsable de prod con `api/supabase/scripts/perf_baseline.sql` (solo lectura).
- Las reglas de Winand quedan en `CLAUDE.md` en forma condensada; el documento completo está en `docs/`.
- Una rama + PR por fase.
- Los totales de Jugadas mantienen la semántica actual (filtros base: organización, fecha, turno, pasador, quiniela y grupo).
- Los totales que hoy salen mal por la paginación se arreglan en la Fase 1.
- Los bugs que no son de rendimiento y el fix de `CLAUDE.md` sobre el deploy de migraciones van en la Fase 7.

## Totales: contrato e inventario

**Contrato (rige todas las fases):**
- Los totales cubren siempre el **set filtrado completo**. Se calculan en el servidor **solo en la primera request** (sin cursor, o `page=1`) y nunca dependen del cursor.
- Todo listado que pase a keyset sigue devolviendo en la primera request lo mismo que hoy: `aggregates` y/o `pagination.totalCount` exacto, según lo que lea la UI.
- Las páginas siguientes no recalculan nada.
- `hasMore` sale de pedir `limit + 1` filas, no de un count.

**QuiniApp (web/):**

| UI | Fuente hoy | Qué hace el plan |
|---|---|---|
| "Total monto de jugadas / aciertos" (`plays-and-hits/total-amount-play-and-hits.tsx`) | `pages[0].aggregates` ← `get_bets_total_amount\|prize` (página 1, filtros base: org, fecha, turno, pasador, quiniela, grupo; ignora ganadores/terna/cuaterna/monto mínimo) | Igual semántica. Se calcula en la primera request (`cursor === ''` o `page === 1`). La Fase 2 lo hace en 1 scan con `get_bets_totals`. |
| "No hay más jugadas (N total)" (`plays-and-hits-table.tsx:168,201`) | `bets.length` cuando `!hasNextPage` | Correcto si `hasMore` es exacto → `limit + 1`. |
| "Tickets cancelados" | `GET /ticket/deleted` (query aparte) | Sin cambio. |
| PDF de impresión (`print-grouped-bets-button.tsx`, `printGroupedBetsPDF.ts`) | Recorre `page=1..N` de 900 filas y suma en el cliente | Modo lista: recorre con cursor hasta `hasMore=false`. Modo agrupado: sigue con `page`, ya con orden determinista (Fase 2). |
| "Cantidad de Tickets" (`terminal-ticket/table-terminal-ticket.tsx:138`) | `tickets.length`: **mal hoy**, cuenta solo lo cargado | **Fix:** `pagination.totalCount` exacto en la primera request de `/ticket`; la UI lee `pages[0].pagination.totalCount`. |
| Detalle de ticket: cantidad, total, aciertos (`TicketDetails.tsx` y tablas de terminal) | `useGetAmountsByTicketNumber` → `GET /bet/amounts` (independiente del listado) | Sin cambio. Se **quita** el `getAmountsByTicket` que corre en la página 1 de `/bet?ticket_number=` y que nadie lee (3 queries menos por click). |
| "Aciertos / Tickets a liquidar" y PDF de liquidación (`CurrentAcoountByUserTable.tsx`, `UserCurrentAccountModal.tsx`, `current-account/handlers/shared.ts`) | `useBets` / `useTickets` sin paginar → **cortados en 100 filas hoy** | **Fix:** helper `fetchAllPages` en web que recorre con cursor (limit 1000) hasta el final. |

**Polla (polla-web/):**
- **Pies "N de M"** (`InfiniteList.tsx:53`) en Jugadas, Administrar jugadas, Resultados, Usuarios, buscador de usuarios, Ediciones y Cuentas de grupo, más el progreso "Cargando X de Y" de `ShareTicketsPdfButton`. Todos leen `pages[0].pagination.totalCount`, que viene del count exacto de la página 1. El feed con cursor ya cumple el contrato y cualquier listado que se toque debe seguir cumpliéndolo.
- **Totales de plata** (ventas, premios, cuentas por edición, cuenta corriente diaria, reportes por rango, `bets_count` de la edición). Salen de RPC o endpoints **sin paginar**, así que el keyset no los afecta. Si la Fase 5 reescribe `polla_daily_sales` / `polla_edition_account_base` / `polla_current_account_period_rows`, se exigen pgTAP de igualdad de sumas.

## Correcciones al plan original (verificadas en código)

**Tamaño de página y contrato**
- Las páginas son de **50** filas: todos los consumidores pasan `limit: 50`.
- El desajuste de `limit` entre la query key y el fetch existe, pero hoy no tiene efecto.
- `organization_ids` siempre es `[req.organization_id]`.

**Embebidos**
- `lotteries` / `schedules` se leen **sin `?.`** en las tablas de terminal y en cuenta corriente. Por eso se **achican** a las columnas que usan `parseLottery` / `parseSchedule`, pero no se quitan.

**Tickets en modo grupo**
- En modo grupo, tickets filtra solo `user_id IN (...)`, sin organización.
- Por eso se conserva `idx_tickets_user_date_deleted_created`.

**Totales y RPC agrupadas**
- Las RPC de totales ya usan `organization_id = ANY(...)`. No se fusionan con la agrupada, porque eso cambiaría lo que significan.
- `get_grouped_bets_count` sobra: nadie muestra el count agrupado. `hasMore` sale de pedir `limit + 1`.
- El orden agrupado (`SUM(amount) DESC, number`) no es determinista. Necesita desempate.

**Polla**
- El N+1 de `groupPreviewsHandler` **ya está resuelto** (`20261115205800`).
- `idx_polla_bets_edition_pending`, `idx_polla_bets_ticket` e `idx_polla_bets_user` ya no existen, e `idx_bets_paid` ya fue dropeado.
- `ticketFilter` hace dos LIKE en OR. La columna generada es válida: los 17 dígitos siempre son la primera corrida de 17 dígitos.
- `useCurrentAccounts` / `useCurrentAccountTotals` (cuenta corriente con offset) **no tienen consumidores**, así que no hace falta pasar la cuenta corriente a keyset.

**Código muerto**
- `getWinnerBets` y `useTotals.ts` no se usan.

**Infraestructura**
- Nunca se usó `CONCURRENTLY`.
- CI solo corre lint + build de la api.
- pgTAP corre solo en local.
- Jest no tiene config; los unit tests usan `node:test` + `tsx`.
- `seed.sql` no existe.
- `api/data/prod_backup_data.sql` es data de prod: **no usarlo como seed**.

## Procedimientos transversales

- **Ramas y migraciones**
  - Rama desde `develop` (`perf/sql-<n>-<tema>`) y PR a `develop`.
  - Migraciones nuevas `YYYYMMDDHHmmss_*.sql`; nunca editar una ya aplicada.
  - Actualizar el CHANGELOG de cada workspace tocado.
  - Consultar Context7 antes de tocar TanStack Query o supabase-js.
- **Push solo a develop:** `npx supabase db push --db-url <pooler develop>`. Prod lo aplica el responsable de prod.
- **Índices en tablas grandes** (`bets`, `bets_archive`, `tickets`, `tickets_archive`, `polla_bets`). Verificado con CLI v2.65.7 (ver `docs/rendimiento-sql-baseline.md`): la CLI corre cada archivo como pipeline.
  - **Opción A (preferida):** una migración por índice, con `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` (o `DROP INDEX CONCURRENTLY IF EXISTS …`) como **única** sentencia del archivo. Con dos o más sentencias falla (SQLSTATE 25001) y deja estado parcial.
  - **Opción B:** crear o dropear a mano con `CONCURRENTLY` vía psql antes del push; la migración lleva `IF NOT EXISTS` / `IF EXISTS` y queda como no-op.
  - En ambos casos, verificar `pg_index.indisvalid` después.
- **Gate por query:** correr `EXPLAIN (ANALYZE, BUFFERS)` antes y después sobre el dataset con volumen. Aceptación:
  - sin `Sort` bajo `Limit` cuando hay un índice alineado;
  - `Rows Removed by Filter` ≈ 0 en el acceso principal;
  - buffers de una página profunda ≈ página 1.
- **Planes de PostgREST (solo local):** `ALTER ROLE authenticator SET pgrst.db_plan_enabled = true; NOTIFY pgrst, 'reload config';` y después `.explain({ analyze: true, buffers: true })`.
- **Checks por PR:** lint + build de los workspaces tocados, `npx supabase test db`, `npx tsx --test <archivo>`.

---

## Fase 0 — Reglas en CLAUDE.md + baseline (`perf/sql-0-baseline`)

1. **`docs/rendimiento-sql-conceptos.md`:** copia textual del doc externo. En `docs/plan-rendimiento-sql.md`, apuntar la referencia a esa ruta y aplicar las correcciones de arriba (incluido el contrato de totales). Commitear ambos.
2. **`CLAUDE.md`:** nueva sección `## SQL Performance (indexes & queries)` después de `## Database Migrations`, en inglés como el resto del archivo, de unas 75 líneas.
   - **Principio:** indexar es tarea de desarrollo; un índice "lento" significa muchas hojas recorridas o muchos accesos a tabla.
   - **WHERE:**
     - nada de funciones o casts sobre columnas;
     - fechas con rangos semiabiertos;
     - lógica inteligente → plpgsql con `EXECUTE format(...) USING`;
     - LIKE/ilike solo con prefijo (o columna generada);
     - los índices parciales exigen repetir el predicado.
   - **Diseño de índices:**
     - igualdad → rango → ORDER BY → desempate;
     - un índice concatenado le gana a varios simples;
     - ASC/DESC mixto se define igual en el índice;
     - auditar los índices existentes antes de crear uno;
     - costo de escritura y HOT updates;
     - `INCLUDE` solo si está medido;
     - procedimiento con `CONCURRENTLY`.
   - **Paginación y totales:**
     - siempre `LIMIT`;
     - keyset con desempate único (row values en SQL; en PostgREST, predicado redundante + OR);
     - cursor opaco y validado con `api/src/utils/keyset.ts`;
     - timestamps como string crudo;
     - `hasMore` con `limit + 1`;
     - el contrato de totales de arriba, con count exacto solo en la primera request y solo si la UI lo lee;
     - OFFSET solo en listas chicas y documentado.
   - **Joins / round-trips / columnas:** sin N+1, sin `select('*')` ni embebidos `(*)`, e indexación según el tipo de join.
   - **Escrituras:** UPDATE solo de las columnas que cambian, y nada de columnas muy actualizadas repetidas en varios índices.
   - **Verificación:** `EXPLAIN (ANALYZE, BUFFERS)` (DML dentro de `BEGIN … ROLLBACK`), las señales del plan, medir con volumen y `supabase inspect db` en solo lectura.
   - **Checklist:** los 15 puntos del §10.
3. **`api/supabase/scripts/perf_baseline.sql`:** solo lectura; el responsable de prod lo corre con psql. Junta:
   - tamaños y conteos de las 5 tablas;
   - `pg_stat_user_indexes`;
   - el ratio HOT de `polla_bets`;
   - el top 20 de `pg_stat_statements` por total y por media;
   - `pg_indexes`;
   - los comandos `supabase inspect db` (subcomandos confirmados con `--help`).
4. **`docs/rendimiento-sql-baseline.md`:** plantilla para pegar la salida de prod y los planes locales.
5. **`api/supabase/scripts/seed_perf.sql`:** local y manual. Usa `generate_series` respetando las FK: ≈1M bets/bets_archive, 200k tickets, 300k polla_bets en 3 ediciones, varias organizaciones, y `ANALYZE` al final.
6. **Local:**
   - Confirmar si `db push` envuelve cada migración en una transacción, con una migración descartable que use `CONCURRENTLY`.
   - Sacar el EXPLAIN baseline de:
     - `getAllBets` (página 1, página profunda, con filtros y por ticket);
     - `ticket getAll`;
     - las agrupadas y los totales;
     - el feed de Polla (ambos órdenes);
     - `getForCheck` / `getByTicketNumber`;
     - `polla_edition_account_base`.
7. **`api/supabase/scripts/perf_explain_local.sql`:** los EXPLAIN del punto 6 como script repetible (con `auto_explain` para el interior de las RPC); se re-corre en el gate de cada fase.
8. Actualizar `api/CHANGELOG.md`. Reordenar las fases si el top de prod lo pide.

## Fase 1 — Keyset en jugadas y tickets QuiniApp + totales rotos (`perf/sql-1-keyset-quiniapp`)

**DB** (una migración por índice con `CREATE INDEX CONCURRENTLY IF NOT EXISTS` como única sentencia; opción A del procedimiento):
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_org_date_feed
  ON bets (organization_id, date, created_at DESC, bet_order, bet_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_archive_org_date_feed
  ON bets_archive (organization_id, date, created_at DESC, bet_order, bet_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_date_feed
  ON tickets (organization_id, date, created_at DESC, ticket_id DESC) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_archive_org_date_feed
  ON tickets_archive (organization_id, date, created_at DESC, ticket_id DESC) WHERE deleted_at IS NULL;
```
Antes, verificar que `bet_order` y `created_at` no tengan NULL en prod (sección 8 de `perf_baseline.sql`; en el esquema ambas columnas son nullable). Si hay NULL: backfill + `NOT NULL`, o ajustar el orden.

**API**
- **`api/src/utils/keyset.ts`:** `encodeCursor` / `decodeCursor` (inválido → `BadRequestError`) más las regex de timestamp, UUID y entero.
  - Se extrae de `api/src/polla/bet/repository/polla-bet.repository.ts:134-186`, y Polla pasa a usarlo sin cambio de comportamiento.
  - Tests en `api/src/utils/keyset.test.ts` (`node:test`).
- **`bet.repository.ts` `getAllBets`:**
  - Nuevo parámetro `cursor?: string`; `''` es la primera página.
  - Orden `created_at DESC, bet_order ASC, bet_id ASC`.
  - Filtro `.lte('created_at', c)` más `.or('created_at.lt.C,and(created_at.eq.C,bet_order.gt.O),and(created_at.eq.C,bet_order.eq.O,bet_id.gt.ID)')`.
  - `.limit(limit + 1)` para calcular `hasMore` y `next_cursor`.
  - Sin `count` en ningún modo: la UI no lo lee.
  - Select explícito: columnas de `parseBet` + `lotteries(lottery_id,name,order,active)` + `schedules(schedule_id,name,time,active)`.
  - Con `ticket_number`: `.eq('ticket_number', n)` + organización sobre la tabla de bets, sin la consulta previa a tickets.
- **`ticket.repository.ts` `getAll`:**
  - Mismo esquema, con orden `created_at DESC, ticket_id DESC`.
  - `count: 'exact'` **solo en la primera request**: alimenta "Cantidad de Tickets".
  - Select explícito.
- **Rutas** (`bet.routes.ts`, `ticket.route.ts`): aceptan `cursor`, `limit` con tope 1000 y un guard de NaN en `page`.
- **Controllers:**
  - Los `aggregates` (totales del día) se calculan en la primera request (`cursor === ''` o `page === 1`), con los mismos filtros que hoy.
  - Se quita `getAmountsByTicket` del camino `ticket_number`: nadie lee esos `aggregates`.
  - Respuesta keyset: `pagination: { pageSize, hasMore, next_cursor, totalCount? }`.
  - El modo agrupado sigue con `page`.
- **`helper/request/pagination.request.ts`:** agrega `next_cursor?: string | null`; `currentPage`, `totalCount` y `totalPages` pasan a opcionales.

**Web**
- **Hooks de listado** (`useInfiniteBets.ts`, `useInfiniteBetsByTicketNumber.ts`, `tickets/useInfiniteTickets.ts`), en modo lista:
  - `initialPageParam: ''`;
  - mandar `cursor`;
  - `getNextPageParam: (last) => last.pagination.hasMore ? last.pagination.next_cursor : undefined`.
  - El modo agrupado conserva `page`. Corregir los defaults de `limit` para que fetch y query key coincidan.
- **`table-terminal-ticket.tsx`:** "Cantidad de Tickets" lee `pages[0].pagination.totalCount`.
- **Helper `fetchAllPages`** (cursor, limit 1000, hasta `hasMore=false`). Lo usan:
  - `useBets.ts` / `useTickets.ts` (cuenta corriente y PDF de liquidación), que dejan de cortarse en 100;
  - el modo lista de `print-grouped-bets-button.tsx`.
- **Invalidaciones:** revisar las de esas keys. Confirmar con Context7 que TanStack v5 recalcula los cursores al refetchear. Para acotar el costo, recortar a la primera página como hace `useRefreshCursorQuery` (`polla-web/src/hooks/useApi.ts`).

## Fase 2 — RPC agrupadas y totales (`perf/sql-2-grouped-rpc`)

- **`get_grouped_bets_page` / `_archive`:**
  - plpgsql `STABLE` con SQL dinámico (`EXECUTE format(...) USING`) que agrega solo los filtros recibidos (organización solo si viene; `user_id = ANY` si hay grupo).
  - `GROUP BY`, con orden `SUM(amount) DESC, number, lottery_id, schedule_id, bet_type, place, with, position` (desempate determinista) y `LIMIT p_limit + 1 OFFSET`.
  - JOIN a `lotteries` / `schedules` **después** del LIMIT, con el mismo shape que espera `parseBet`.
  - La tabla entra por `format('%I')`.
  - Sin count: `hasMore` sale de la fila extra.
- **`get_bets_totals` / `_archive`:** `SUM(amount)` y `SUM(prize) FILTER (WHERE winner)` en un solo scan, con **la misma semántica de hoy** (filtros base).
- **Grants:** el patrón de las migraciones recientes (service_role).
- **Repository y controller:**
  - Agrupada, página 1: de 4 scans a 2 (página + totales).
  - Lista, primera request: de 2 a 1.
  - Las funciones viejas quedan hasta la Fase 6.
- **pgTAP `250_get_grouped_bets_page.test.sql`:** comparar contra las funciones viejas.
  - mismo set de filas;
  - el orden respeta `SUM(amount) DESC, number`;
  - totales = suma de las dos RPC viejas, con varias combinaciones de filtros.

## Fase 3 — Polla: ticket y keyset (`perf/sql-3-polla-ticket-keyset`)

- **Migración:**
  - `ALTER TABLE polla_bets ADD COLUMN ticket_stamp TEXT GENERATED ALWAYS AS (substring(ticket_number from '[0-9]{17}')) STORED;`. Reescribe la tabla con lock exclusivo: correrla fuera del horario de carga.
  - Índice `idx_polla_bets_org_ticket_stamp (polla_organization_id, ticket_stamp)`.
  - Antes: grep de `INSERT INTO polla_bets` sin lista de columnas y de `SELECT *` en funciones.
- **`polla-bet.repository.ts`:**
  - `ticketFilter`: con 17 dígitos → `.eq('ticket_stamp', n)`; si no → `.eq('ticket_number', n)`.
  - `afterCursor`: agregar el acceso redundante (`hits <= H` / `created_at <= C`) junto al OR actual.
  - El count exacto de la primera request no se toca (pies "N de M" y el PDF).
- **pgTAP:** `ticket_stamp` correcto en los dos formatos de ticket.
- **Índice parcial para cuentas por edición:** solo si aparecen en el top de la Fase 0.

## Fase 4 — Polla: listados con offset (`perf/sql-4-polla-offset`)

- **Desempate único** en los listados con offset que hoy no son deterministas:
  - resultados: `date DESC, polla_result_id DESC`;
  - usuarios: `+ polla_user_id`;
  - cuentas de grupo: `+ id`;
  - cuenta corriente: `+ polla_current_account_id`.
- **Siguen con offset**, con un comentario en el código que explica por qué: resultados, usuarios, ediciones, catálogos, cuentas de grupo y `useDoneEditionAccounts`. Son chicos, acotados por organización, y el count de la página 1 alimenta "N de M".
  - Se descarta el keyset de la cuenta corriente: su hook no tiene consumidores.
- **`select('*')` → columnas explícitas** en current-account, result, catalog y group-account.
- **Opcional:** param `count=false` para los callers que no leen el count (`WinnersBanner`, check-ticket).

## Fase 5 — Round-trips (`perf/sql-5-round-trips`)

- `current-account.controller.ts:211-214`: una RPC que recibe `uuid[]` en vez de una llamada por organización.
- `current-account.route.ts:447-451` (`PUT /bulk`): una RPC batch en jsonb que devuelve las filas actualizadas.
- `getAmountsByTicket`: una sola RPC que resuelve la tabla y las sumas.
- Borrar `getWinnerBets` y `useTotals.ts`.
- **Condicionales al top de la Fase 0:**
  - `getAllTicketNumber`;
  - SQL dinámico en `polla_daily_sales`, `polla_current_account_period_rows` y `polla_edition_account_base`, con pgTAP de igualdad de sumas.

## Fase 6 — Limpieza (`perf/sql-6-cleanup`, ≥1 semana después del deploy a prod)

- El responsable de prod vuelve a correr `perf_baseline.sql` y se compara `idx_scan`.
- **Drop** (`DROP INDEX CONCURRENTLY IF EXISTS`, una migración por índice):
  - `idx_bets_org_date_active`
  - `idx_bets_ticket_id`
  - `idx_tickets_date_org_active`
  - `idx_tickets_date_deleted_winner_created`
  - `idx_tickets_organization_id`
  - `idx_tickets_total_prize`
  - `idx_polla_bets_edition_hits`
- `idx_bets_date` / `idx_tickets_date`: dropearlos solo si `archive_data_by_date` y generate_winners no los usan.
- Dropear `get_grouped_bets_for_parse`, `get_grouped_bets_count`, `get_bets_total_amount` y `get_bets_total_prize`, con sus `_archive`.

## Verificación end-to-end

1. **Planes:** el EXPLAIN de la Fase 0, repetido después de cada migración y registrado en el baseline.
2. **Keyset:** `api/scripts/verify-keyset.ts` (tsx, contra Supabase local) recorre bets, tickets y el feed de Polla y los compara con la query sin paginar: mismo set, mismo orden, sin duplicados, incluso con `created_at` empatado. Un cursor inválido responde 400.
3. **Totales:** el mismo script compara:
   - `aggregates` de la primera request contra la suma SQL directa con los filtros base;
   - `totalCount` de tickets contra `COUNT(*)`;
   - `fetchAllPages` contra el total sin paginar, con más de 100 y más de 1000 filas.
4. **pgTAP:** `npx supabase test db`.
5. **Manual web:**
   - Jugadas: totales iguales a hoy con cada filtro (ganadores y terna incluidos), scroll hasta el final, agrupado, búsqueda por ticket, día archivado.
   - Imprimir en ambos modos y comparar los totales del PDF.
   - Tickets: "Cantidad de Tickets" con más de 50.
   - Cuenta corriente: aciertos y tickets a liquidar con más de 100, y el PDF de liquidación.
   - Cargar un ticket en otra pestaña mientras se scrollea.
6. **Manual polla-web:**
   - Pies "N de M" en todos los listados.
   - Feed en ambos órdenes.
   - "Revisar ticket" con 17 dígitos y con ticket completo.
   - PDF de tickets: el progreso "X de Y".
   - Ventas, premios y cuentas por edición sin cambios.
7. **Post-deploy:** comparar `pg_stat_statements` / `idx_scan` a la semana.

## Fase 7 — Bugs detectados + fix de CLAUDE.md (`fix/sql-7-pendientes`, después de la Fase 6)

Son bugs que aparecieron durante el relevamiento y no son de rendimiento. Cada ítem lleva su entrada en el CHANGELOG del workspace.

**QuiniApp**
- **`api/src/shcedule/helper/parseSchedule.ts`:** `time.slice(0.5)` → `slice(0, 5)`. Antes, grep de los consumidores de `schedule.time` en web: hoy reciben `HH:MM:SS` y algún formateo podría depender de eso.
- **`web/.../useScheduleMap.ts:21`:** `useSchedules(true)` → el objeto de opciones correcto, según la firma del hook.
- **`GET /bet` sin `date`:** responder 400 en vez de 500 (`bet.routes.ts:130-138`).
- **El listado normal ignora `min_amount`:** el controller no lo pasa a `getAllBets` (`bet.controller.ts:99-112`).
  - Pasarlo y filtrar con la misma semántica que el modo agrupado.
  - Antes, confirmar en la RPC agrupada si `p_min_amount` es por jugada o por `SUM`, y qué dice el label en la UI.
- **Totales en pantalla vs. PDF:** no cambia la semántica (decisión tomada). Solo se agrega un comentario en `bet.controller.ts` y en `get_bets_totals` que aclara que los totales usan los filtros base.
- **Tickets en modo grupo sin filtro de organización** (`ticket.repository.ts:124-131`, `getAllTicketNumber` 254-261):
  - Confirmar si un grupo puede abarcar varias organizaciones de la red.
  - Si no puede, agregar el filtro por organización: corrige el alcance y además habilita `idx_tickets_org_date_feed`.

**Polla**
- **`WinnersBanner.tsx`:** hoy se corta en 50 sin avisar. Pedir un `limit` explícito acorde al banner, o mostrar "y N más" con el count de la primera request.
- **check-ticket:** los ganadores se cortan en 100 (`polla-bet.route.ts:575-579`). Mostrar el total real con el count, e indicar cuando hay más que los listados.
- **`useEditionAccountList` con limit 200** (`GroupEditionAccounts.tsx:432`, `EditionReportDialog.tsx:136`): el reporte multi-edición solo suma esas 200. Recorrer todas las páginas, o calcular los totales con la RPC `polla_edition_account_totals` sobre todas las ediciones.
- **`ShareTicketsPdfButton`:** usa dos fuentes para la cantidad (primero `edition.bets_count`, después el count del feed). Unificar en el count del feed y mostrar un indicador indeterminado hasta la primera respuesta.

**Repo — `CLAUDE.md`**
- `## Database Migrations` → `Migration Workflow`: reemplazar el paso 5 ("automatically applied in deployment pipeline", que nada en el repo hace) por el procedimiento real:
  - `npx supabase db push --db-url <pooler URI>` a mano;
  - develop primero, y prod la aplica el responsable;
  - referencia al procedimiento `CONCURRENTLY` de la sección SQL Performance para tablas grandes.

**Verificación**
- Lint + build de api, web y polla-web.
- Manual:
  - formato de horario en turnos y tickets;
  - filtro de monto mínimo en lista y agrupado;
  - `GET /bet` sin fecha → 400;
  - banner de ganadores y "Revisar ticket" con más de 100 ganadores;
  - reporte multi-edición con más de 200 ediciones (dataset local);
  - progreso del PDF de tickets.
