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
| **Estado actual** (delta entre dos fotos, sin resetear estadísticas) | prod, T0 y T1 con ≥24 h hábiles en el medio | `psql "<pooler URI>" -f api/supabase/scripts/perf_stats_snapshot.sql > stats-T0.csv` (después, `stats-T1.csv`) y `npx tsx api/supabase/scripts/perf_stats_diff.ts stats-T0.csv stats-T1.csv` |

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

## Baseline de prod — 2026-11-16

**Entorno:** PostgreSQL 17.6 (aarch64). `shared_buffers` 256 MB, `effective_cache_size` 768 MB, `work_mem` 3,5 MB, `random_page_cost` 1.1, `jit` off, `plan_cache_mode` auto.

> **Ojo al leer estos números.** `pg_stat_statements` y `pg_stat_user_*` **acumulan desde 2025-09-16** (14 meses, nunca se resetearon). Mezclan problemas ya resueltos con los actuales; por ejemplo, `idx_bets_ticket_number` recién se creó el 2026-04-04 (`20260404120000`). Para decidir con el estado actual: dos fotos con `perf_stats_snapshot.sql` y la comparación con `perf_stats_diff.ts` (ver "Cómo medir").

### Tamaño y actividad de tablas (secciones 1–2)

| Tabla | Filas | Tabla + índices | Índices | Nota |
|---|---|---|---|---|
| `bets_archive` | 3,28M | 1075 MB + 393 MB | 7 | 4 veces `shared_buffers`: todo lo que la recorre va a disco. Recibe 31–44k filas por día del archivado |
| `bets` | 93k | 26 MB + 27 MB | 10 | Históricamente: 9,3M inserts, 11,1M updates (22,8 % HOT), 10,2M deletes (el archivado vacía la tabla) |
| `tickets_archive` | 53k | 12 MB + 10 MB | 5 | |
| `tickets` | 1,5k | 0,4 MB + 1,4 MB | **13** | 13 índices para ~1,5k filas vivas; cada carga de ticket los mantiene todos |
| `polla_bets` | 316 | 0,3 MB + 0,5 MB | 16 | Volumen mínimo |

**Señal a seguir:** `bets` acumula **18.802 seq scans con 16,1 mil millones de tuplas leídas** (~857k por scan). Algo recorre la tabla entera. Puede ser histórico (`get_ticket_sums` antes del índice); el delta lo confirma o lo descarta.

### Uso de índices (sección 3) — candidatos a drop

- **Confirmados para la Fase 6:**
  - `idx_tickets_total_prize`: 0 scans en 14 meses.
  - `idx_bets_ticket_id` (437k scans): es prefijo de `idx_bets_ticket_order` (121k), así que el planner pasa a usar este.
- **Candidatos nuevos** (validar con el delta):
  - `idx_tickets_winner_user_deleted_created`: 1 scan.
  - `idx_tickets_winner_deleted_created`: 2 scans.
  - `idx_bets_archive_schedule_date_org_active`: 4 scans y 41 MB, y encarece cada lote de `archive_data_by_date`.
- **A revisar:**
  - `idx_tickets_deleted_by`: 2 scans. Mantenerlo si respalda una FK.
  - `idx_bets_archive_user_id` (182 scans) e `idx_bets_archive_lottery_id` (208): verificar si respaldan FKs.
- **`idx_bets_date`** (145k scans, 3,28 mil millones de tuplas leídas) es la puerta de entrada de la lógica inteligente de las agrupadas (Fase 2) y del archivado. Se decide después de la Fase 2.
- **`polla_bets`** tiene 4 índices con 0 scans, pero con 344 filas el planner prefiere el seq scan. **No sirve para decidir drops en Polla.**

### Top queries (secciones 6–7, acumulado de 14 meses, agrupado por familia)

| Familia | Calls | Total | Media | Nota | Fase |
|---|---|---|---|---|---|
| `get_ticket_sums` (4 entradas) | 34.040 | **5,7 h** | 606 ms | ~150M bloques leídos de disco. La definición actual con `idx_bets_ticket_number` (abril 2026) debería tardar <1 ms; el costo es casi seguro histórico. **Confirmar con el delta** | 1 (quitar la llamada sobrante) y 5 (RPC única) |
| `create_ticket_with_bets` (3) | 126.782 | 1,5 h | 43 ms (la actual: 32 ms, ~5k buffers por ticket) | Escritura más frecuente; mantiene 10 índices de `bets` + 13 de `tickets` | 6 (bajar índices) |
| `archive_data_by_date` (2) | 13.516 | 1,2 h | 315 ms por lote | Cron. Inserta en `bets_archive` (7 índices) y borra de `bets` (10) | **Nuevo** |
| Agrupadas + totales: `get_grouped_bets_for_parse` (44k, 35 ms), variante de 6 parámetros (5,7k, 103 ms), `get_grouped_bets_count` (36k, 20 ms), `get_bets_total_*` (105k, 12 ms) | 190k | 1,15 h | — | Lógica inteligente | 1 y 2 |
| `generate_winners*` (5) | 3.385 | 0,9 h | ~985 ms (máx. 18,4 s) | ~120k buffers por llamada; la ve el usuario al cargar resultados. **No está en el plan** | **Nuevo** |
| `GET /bet` PostgREST (`bets.*, lotteries(*), schedules(*)`, 4 variantes) | 50.686 | 0,86 h | 28–424 ms | Offset + sort | 1 |
| `GET /bet` sobre `bets_archive` (2) | 112 | 51 s | 368–558 ms | Sin índice que empiece por organización | 1 |
| `get_archive_stats` + count exacto de todo `bets_archive` (fallback de `archive.service.ts`) | 433 | 0,35 h | **~2,9 s** | Panel de archivo (admin); recorre las tablas enteras | 5 (barato: `reltuples` o contadores) |
| `auth_audit_log` insert | 201.597 | 0,15 h | 2,75 ms | OK | — |

### Calidad de datos para keyset (sección 8)

`created_at` y `bet_order` en NULL: **0** en las 6 combinaciones. La Fase 1 queda desbloqueada sin backfill.

Agregar `NOT NULL` en el esquema es opcional: `SET NOT NULL` recorre la tabla con lock exclusivo; en `bets_archive` hay que hacerlo fuera de horario.

### Volumen por organización/día y archivo (secciones 9–10)

- **Jugadas:** la organización más grande tiene ~27k jugadas y ~360 tickets por día, unas 75 jugadas por ticket. Con páginas de 50 son hasta ~540 páginas de jugadas y ~8 de tickets.
- **Empates de `created_at`:** hasta **1.254 jugadas con el mismo `created_at`** en una organización y día, porque un ticket entero se inserta con el mismo `now()`. El desempate `(bet_order, bet_id)` del keyset es imprescindible.
- **Tickets:** ≤364 por día y organización. El keyset de tickets aporta poco en rendimiento; el valor de la Fase 1 ahí es el fix de "Cantidad de Tickets", que con 364 tickets hoy muestra solo los cargados. El count de tickets es barato.
- **Archivo:** 31–44k jugadas por día, de 3–4 organizaciones.

### Polla: formatos de ticket (secciones 11–13)

- **Volumen:** 4 ediciones, la más grande con 111 jugadas.
- **Formatos:**
  - `<grupo>-<17>-<pasador>-<jugador>`: 241;
  - `<17>-<pasador>`: 103;
  - **0** con otro formato y **0** inconsistentes, así que la columna generada `ticket_stamp` es válida.
- **Prioridad:** el rendimiento de Polla no es un problema hoy, así que las Fases 3 y 4 bajan de prioridad. Excepción: agregar `ticket_stamp` ahora es casi gratis (reescribe 344 filas); con volumen, la reescritura necesita una ventana.

### Lectura para el plan

1. **Fase 1 sigue como está.** Los datos están bien para keyset, y `GET /bet` + totales suman ~1 h acumulada.
2. **Antes de reordenar el resto, hace falta el delta** (T0 ahora, T1 después de ≥24 h hábiles). En particular, para saber:
   - si `get_ticket_sums` todavía pesa;
   - quién hace los seq scans de `bets`;
   - cuánto cuestan **hoy** `generate_winners*` y `archive_data_by_date`.
3. **Fuera del plan original:** `generate_winners_and_calculate_accounts` (~1 s por llamada, la ve el usuario) y `archive_data_by_date`. Si el delta los confirma, se suman como fase nueva (investigar los planes internos con `auto_explain` en local).
4. **Fase 6:** suma los candidatos de arriba, siempre validados con el `idx_scan` del delta.

## Delta de prod — 24,2 h (2026-11-17 00:33 → 2026-11-18 00:42 UTC)

Comparación de dos fotos de `perf_stats_snapshot.sql` con `perf_stats_diff.ts`, sin resets en el medio. Es el **estado actual**; la Fase 1 todavía no estaba en prod.

**Conclusión:** prod está tranquilo. Todo el tiempo de base del día suma **75 s**. El costo acumulado en 14 meses era sobre todo histórico.

| # | Qué | Llamadas | Media | Total | % | Nota |
|---|---|---|---|---|---|---|
| 1 | `archive_data_by_date` (por lote) | 72 | 264 ms | 19,0 s | 25 | Cron nocturno; nadie lo espera. ~22k buffers por lote: mantiene los índices de `bets_archive` |
| 2 | `create_ticket_with_bets` | 491 | 23 ms | 11,4 s | 15 | Aceptable; ~4k buffers por ticket |
| 3 | `generate_winners_and_calculate_accounts` | 27 | **311 ms** | 8,4 s | 11 | Lo espera el usuario. ~50k buffers por llamada → **Fase 1b** |
| 4 | `get_archive_stats` | 2 | **4,2 s** | 8,3 s | 11 | Panel de archivo → **Fase 1c** |
| 5 | `get_bets_total_amount` / `_prize` | 405 + 405 | 12 / 0,6 ms | 5,1 s | 7 | Fase 2 los une |
| 6 | `GET /bet` PostgREST (offset, 5 variantes) | ~340 | 5–69 ms | ~6 s | 8 | Fase 1 (a prod) |
| 7 | `get_grouped_bets_for_parse` + `_count` | 131 + 92 | 16 / 13 ms | 3,3 s | 4 | Página 1 de agrupadas ≈ 40 ms en prod |

- **`get_ticket_sums` no aparece.** Lo más caro del acumulado de 14 meses era histórico, de antes de `idx_bets_ticket_number` (abril de 2026).
- **Seq scans de `bets`:** 27 en el día, que coinciden con las 27 llamadas de `generate_winners`. Con `bets` chica (93k filas), el planner resuelve el `UPDATE … FROM` con hash join + seq scan. No es lo que más pesa: lo que domina son las reescrituras de todas las jugadas del turno (ver la Fase 1b).
- **Índices sin uso en 24 h:**
  - en `tickets`: `idx_tickets_total_prize`, `idx_tickets_winner_deleted_created`, `idx_tickets_winner_user_deleted_created`, `idx_tickets_date_deleted_winner_created` → Fase 1c;
  - `idx_tickets_deleted_by` → se queda, respalda una FK;
  - en `bets_archive`: `lottery_id`, `user_id`, `schedule_date_org_active` y `ticket_number` → se quedan. Los tres primeros respaldan FKs con `ON DELETE SET NULL` sobre 3,3M filas, y `ticket_number` lo usa la búsqueda de tickets archivados.

## Mediciones después de cada fase

| Fase | Fecha | Query | Antes | Después | Nota |
|---|---|---|---|---|---|
| 1 | 2026-11-16 | Q1 `GET /bet` página 1 | 390 ms: Sort de 122k filas bajo Limit | **0,13 ms** keyset (Q1k): `idx_bets_org_date_feed`, sin Sort, 55 buffers | La query vieja con offset también deja de ordenar (0,8 ms): el índice cubre su ORDER BY |
| 1 | 2026-11-16 | Q2 `GET /bet` página profunda (fila 9.950) | 448 ms: sort en disco, 11,5k bloques temporales | **0,08 ms** keyset (Q2k): 26 buffers, 6 filas descartadas | Con offset, la misma profundidad tarda 92 ms (lee 10k filas) |
| 1 | 2026-11-16 | Q5 `GET /ticket` página 1 / profunda | 9,5 / 19,6 ms | **0,07 ms** (Q5k, index only scan) | El count de la primera request sigue (2 ms) para "Cantidad de Tickets" |
| 1 | 2026-11-16 | Q6 `GET /bet` en día archivado | 20 ms: 25.630 filas descartadas | **0,1 ms** (Q6k, index only scan sobre `idx_bets_archive_org_date_feed`) | |
| 1 | 2026-11-16 | Q4 `GET /bet?ticket_number` | 2 round-trips | 1 round-trip (Q4b, 0,2 ms) | |
| 1 | 2026-11-16 | Q2x organización con `= ANY(array)` (`.in()`) | — | 40 ms, vuelve el Sort (PG15 local) | Por eso el repositorio filtra la organización con `.eq()` |
| 1 | 2026-11-16 | HTTP local `GET /bet` (lista) | — | Página 1 con totales: 65 ms. Página 2: 17 ms | `verify-keyset.ts`: 122.590 jugadas en 137 páginas sin duplicados ni saltos |
| 1 | 2026-11-16 | Página 1 de agrupadas (HTTP local) | ≈590 ms (4 RPC) | 375 ms, sin cambio | Objetivo de la Fase 2 |
| 1b | 2026-11-18 | `generate_winners_and_calculate_accounts`, primera carga del turno (local, 24,5k jugadas) | 27,6 s; 90k bloques modificados | **3,8 s**; 32k | Mismo resultado (checksums de jugadas, tickets, `ticket_prizes_by_turn` y cuentas) |
| 1b | 2026-11-18 | Ídem, re-run con los mismos resultados | 12,0 s; 73k bloques modificados | **3,2 s**; 1,2k | El re-run ya no reescribe filas (pgTAP 260) |
| 1b | 2026-11-18 | Prod (delta de 24 h) | 311 ms, ~50k buffers por llamada | Pendiente: medir con otro delta después del deploy | En local, lo que queda es la reinserción de `ticket_prizes_by_turn` (el seed tiene un ticket por jugada; en prod son ~360 tickets por día y organización) |
