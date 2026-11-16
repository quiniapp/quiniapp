# Baseline de rendimiento SQL

> Plan: `docs/plan-rendimiento-sql.md` · Conceptos: `docs/rendimiento-sql-conceptos.md` (las referencias `§n` apuntan ahí).
> Este documento registra las mediciones **antes/después** de cada fase. Toda decisión sobre índices (crear o dropear) se respalda con números de acá.

## Cómo medir

| Qué | Dónde | Comando |
|---|---|---|
| Inventario, uso de índices, top queries, calidad de datos | **prod** (solo lectura, lo corre el responsable) | `psql "<pooler URI>" -f api/supabase/scripts/perf_baseline.sql > baseline-prod.txt` |
| Complemento CLI (v2.65.x) | prod | `npx supabase inspect db outliers\|calls\|index-stats\|table-stats\|traffic-profile\|vacuum-stats\|bloat --db-url "<pooler URI>"` |
| Dataset con volumen | **local** | `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v confirm_local=yes -f api/supabase/scripts/seed_perf.sql` |
| Planes de las queries calientes | local | `psql … -v confirm_local=yes -f api/supabase/scripts/perf_explain_local.sql > explain-local.txt` |

Criterio de aceptación por query (gate de cada fase): sin `Sort` bajo `Limit` cuando hay índice alineado; `Rows Removed by Filter` ≈ 0 en el acceso principal; buffers de página profunda ≈ página 1.

## Hallazgo de infraestructura: `CREATE INDEX CONCURRENTLY` y `supabase db push`

Probado en local con Supabase CLI **v2.65.7** (2026-11-16):

- La CLI manda las sentencias de cada archivo de migración en un **pipeline**.
- Un archivo con **una sola** sentencia `CREATE INDEX CONCURRENTLY …` se aplica bien y queda registrado en `schema_migrations`.
- Un archivo con **dos o más** sentencias falla con `CREATE INDEX CONCURRENTLY cannot be executed within a pipeline (SQLSTATE 25001)` y **deja estado parcial**: la primera sentencia queda aplicada y la migración no se registra.

Procedimiento adoptado para tablas grandes:

- **Opción A (preferida):** una migración por índice, con `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` como **única** sentencia del archivo.
- **Opción B:** crear el índice a mano con `CONCURRENTLY` vía psql antes del push, y que la migración lleve `CREATE INDEX IF NOT EXISTS` (no-op).

En los dos casos, verificar después `SELECT indexrelid::regclass, indisvalid FROM pg_index WHERE NOT indisvalid;` (un `CONCURRENTLY` fallido deja un índice inválido que `IF NOT EXISTS` no repara).

Revalidar si se actualiza la CLI (hay una v3).

## Baseline local — 2026-11-16 (antes de la Fase 1)

**Dataset (`seed_perf.sql`)**
- 1M `bets` y 200k `tickets` (4 organizaciones × 2 días activos, ~122k jugadas y ~24,5k tickets por organización y día).
- 1,02M `bets_archive` y 204k `tickets_archive` (30 días).
- 305k `polla_bets`: 6 ediciones de ~50k, más los datos de prueba previos.

**Entorno:** PostgreSQL local de Supabase, caché caliente salvo que se indique `read`. Los tiempos son de una corrida y sirven para orientarse; lo que se compara son la forma del plan y los buffers.

| # | Query | Plan | Tiempo | Buffers | Señal |
|---|---|---|---|---|---|
| Q1 | `GET /bet` página 1 (`*, lotteries(*), schedules(*)`) | Bitmap `idx_bets_org_date_active` (122k filas) → **Sort top-N** bajo Limit | 390 ms | 6.854 | Lee y ordena el día completo de la organización para devolver 50 (§7) |
| Q1b | count exacto de `GET /bet` | Index Only Scan `idx_bets_org_date_active` | 10 ms | 102 | Barato: el costo está en el sort, no en el count |
| Q2 | `GET /bet` página 200 (OFFSET 9950) | Igual que Q1, con **external merge en disco (31 MB)** | 448 ms | 6.856 + temp 11.525 | Se degrada con la profundidad |
| Q3 | `GET /bet` filtrado por pasador | Bitmap `idx_bets_user_date_deleted` (6k) → Sort | 7 ms | 4.744 | Aceptable: rango ya acotado |
| Q4 | `GET /bet?ticket_number` hoy (tickets → bets por ticket_id) | 2 index scans | <1 ms | 12 | Correcto, pero son 2 round-trips |
| Q4b | Propuesta: bets por `ticket_number` directo | Bitmap `idx_bets_ticket_number` + filtro de organización | <1 ms | 23 | Un round-trip; filtra 15 filas de otras organizaciones |
| Q5 | `GET /ticket` página 1 | Bitmap `idx_tickets_date_org_active` (24,5k) → Sort | 9,5 ms | 3.470 | Mismo patrón que Q1, en menor escala |
| Q5b | count de tickets | Index Only Scan | 1,9 ms | 22 | Barato |
| Q5c | `GET /ticket` página 200 | Igual, con un sort más grande | 19,6 ms | 3.470 | Se degrada con la profundidad |
| Q6 | `GET /bet` en día archivado | Bitmap `idx_bets_archive_date` → **Rows Removed by Filter: 25.630** | 20 ms | 3.361 (read) | No hay índice que empiece por organización en el archivo (§2.6) |
| Q6b | `GET /ticket` en día archivado | Bitmap `idx_tickets_archive_date_org_active` → Sort | 0,9 ms | 137 | OK con este volumen |
| Q7a | `get_grouped_bets_for_parse` | Bitmap **`idx_bets_date` (500k filas, todas las organizaciones)** → filtro → sort en disco | 288 ms | 27.000 + temp | Lógica inteligente: la organización no es predicado de acceso (§2.11) |
| Q7b | `get_grouped_bets_count` | Mismo recorrido | 258 ms | 27.000 + temp | Segunda pasada completa |
| Q7c | `get_bets_total_amount` | Bitmap `idx_bets_org_date_active`; filas estimadas 1, reales 122k | 43 ms | 6.751 | Estimación rota por los `IS NULL OR` |
| Q7d | `get_bets_total_prize` | `idx_bets_date_schedule_winner_deleted` | <1 ms | 2 | OK (índice parcial de ganadores) |
| — | **Página 1 de agrupadas (Q7a+b+c+d)** | 4 RPC | **≈590 ms** | ≈61.000 | Objetivo de la Fase 2: 2 pasadas |
| Q8a | Feed Polla ranking, página 1 | Index Scan `idx_polla_bets_edition_ranking` | 0,1 ms | 54 | OK |
| Q8b | Feed ranking, cursor en fila 10.000 (OR puro, hoy) | Index Scan con **Rows Removed by Filter: 10.001** | 5,9 ms | 10.155 | El OR no acota el índice (§7) |
| Q8c | Igual + acceso redundante `hits <= H` | Rows Removed: 2.424 | 1,3 ms | 2.503 | Mejora 4×, pero no llega a O(N) |
| Q8d | Igual con row values `(hits, created_at, id) < (…)` | Rows Removed: 0 | 0,09 ms | 54 | Ideal: buffers iguales a la página 1 |
| Q8e | Feed recientes, cursor profundo (OR puro) | **Rows Removed: 36.840** | 20 ms | 37.296 | Crece con la profundidad |
| Q9 | `polla_edition_account_rows` | Varios scans chicos | 32 ms | 3.500 | OK con este volumen |
| Q10 | `polla_daily_sales` (edición) | Bitmap `idx_polla_bets_org_load_date` → **Rows Removed 99k**, nested loop sobre grupos ×49k, sort en disco | 147 ms | 57.000 + temp | Candidata a SQL dinámico (Fase 5, si aparece en prod) |
| Q11 | Polla "Revisar ticket" con 17 dígitos | **Parallel Seq Scan** sobre `polla_bets` | 29 ms | 14.600 | Comodín inicial (§2.7): crece con todo el histórico |

**Lectura para las fases siguientes**

- **Fase 1:** el problema de jugadas es el **sort**, no el count; el keyset con el índice alineado `(org, date, created_at DESC, bet_order, bet_id)` lo elimina. El count de tickets es barato, así que mantenerlo en la primera request para "Cantidad de Tickets" está justificado.
- **Fase 2:** las agrupadas son lo más caro medido (~590 ms por página 1). El SQL dinámico con la organización como acceso, más una sola pasada por página y otra para los totales, es la palanca.
- **Fase 3:** el predicado redundante ayuda (Q8c), pero los row values (Q8d) son 15× mejores. Evaluar la RPC `polla_bets_feed` en lugar de quedarse solo con la condición redundante. "Revisar ticket" necesita `ticket_stamp`.

## Baseline de prod

> Pendiente: lo corre el responsable con `perf_baseline.sql` y pega la salida acá (o un resumen con los puntos clave).

### Fecha de la corrida / `stats_reset`

### Tamaño y actividad de tablas (secciones 1–2)

### Uso de índices (sección 3) — candidatos a drop

### Top queries por tiempo total y medio (secciones 6–7)

### Calidad de datos para keyset (sección 8)

Si hay `created_at` o `bet_order` en NULL, hay que decidirlo antes de la Fase 1.

### Volumen por organización/día y archivo (secciones 9–10)

### Polla: formatos de ticket (secciones 12–13)

Si hay formatos "OTRO" o inconsistencias, hay que revisarlo antes de la Fase 3.

## Mediciones después de cada fase

| Fase | Fecha | Query | Antes | Después | Nota |
|---|---|---|---|---|---|
