-- =============================================================================
-- perf_baseline.sql — Relevamiento de rendimiento (SOLO LECTURA)
-- =============================================================================
-- Pensado para correr contra PROD (o develop) y pegar la salida en
-- docs/rendimiento-sql-baseline.md. No escribe nada: solo SELECT sobre
-- catálogos, vistas de estadísticas y tablas.
--
-- Uso (pooler en modo sesión, ver memoria/README del proyecto):
--   psql "<pooler URI>" -f api/supabase/scripts/perf_baseline.sql > baseline-prod.txt
--
-- Complemento con la CLI (v2.65.x; confirmar con `npx supabase inspect db --help`):
--   npx supabase inspect db outliers      --db-url "<pooler URI>"
--   npx supabase inspect db calls         --db-url "<pooler URI>"
--   npx supabase inspect db index-stats   --db-url "<pooler URI>"
--   npx supabase inspect db table-stats   --db-url "<pooler URI>"
--   npx supabase inspect db traffic-profile --db-url "<pooler URI>"
--   npx supabase inspect db vacuum-stats  --db-url "<pooler URI>"
--   npx supabase inspect db bloat         --db-url "<pooler URI>"
--
-- Las secciones son independientes: si una falla (p. ej. pg_stat_statements no
-- habilitado) las demás siguen.
-- =============================================================================

\set ON_ERROR_STOP off
\pset pager off
\pset null '∅'
\timing off

-- Defensa extra: toda la sesión en modo solo lectura.
SET default_transaction_read_only = on;
SET statement_timeout = '60s';

\echo '=== 0. Servidor y configuración relevante para el planner'
SELECT version();
SELECT name, setting, unit
FROM pg_settings
WHERE name IN ('shared_buffers', 'effective_cache_size', 'work_mem', 'random_page_cost',
               'seq_page_cost', 'plan_cache_mode', 'default_statistics_target', 'jit')
ORDER BY name;
SELECT datname, stats_reset FROM pg_stat_database WHERE datname = current_database();

\echo '=== 1. Tamaño y filas estimadas de las tablas calientes'
SELECT c.relname                                         AS tabla,
       c.reltuples::bigint                               AS filas_estimadas,
       pg_size_pretty(pg_table_size(c.oid))              AS tabla_size,
       pg_size_pretty(pg_indexes_size(c.oid))            AS indices_size,
       (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid) AS cant_indices
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE c.relname IN ('bets', 'bets_archive', 'tickets', 'tickets_archive', 'polla_bets',
                    'polla_editions', 'polla_current_accounts', 'polla_results', 'current_accounts')
ORDER BY pg_total_relation_size(c.oid) DESC;

\echo '=== 2. Actividad por tabla (seq vs idx, escrituras, HOT updates, vacuum)'
SELECT relname                AS tabla,
       seq_scan, seq_tup_read, idx_scan,
       n_tup_ins, n_tup_upd, n_tup_hot_upd,
       CASE WHEN n_tup_upd > 0 THEN round(100.0 * n_tup_hot_upd / n_tup_upd, 1) END AS hot_pct,
       n_tup_del, n_live_tup, n_dead_tup,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE relname IN ('bets', 'bets_archive', 'tickets', 'tickets_archive', 'polla_bets',
                  'polla_editions', 'polla_current_accounts', 'polla_results', 'current_accounts')
ORDER BY relname;

\echo '=== 3. Uso de cada índice de las tablas calientes (idx_scan = 0 → candidato a revisar)'
SELECT s.relname                                  AS tabla,
       s.indexrelname                             AS indice,
       s.idx_scan,
       s.idx_tup_read,
       s.idx_tup_fetch,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
       i.indisunique                              AS unico,
       i.indisvalid                               AS valido
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.relname IN ('bets', 'bets_archive', 'tickets', 'tickets_archive', 'polla_bets')
ORDER BY s.relname, s.idx_scan, s.indexrelname;

\echo '=== 4. Definición real de los índices vigentes'
SELECT tablename AS tabla, indexname AS indice, indexdef AS definicion
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('bets', 'bets_archive', 'tickets', 'tickets_archive', 'polla_bets')
ORDER BY tablename, indexname;

\echo '=== 5. pg_stat_statements: desde cuándo acumula'
SELECT * FROM extensions.pg_stat_statements_info;

\echo '=== 6. pg_stat_statements: top 20 por tiempo total'
SELECT calls,
       round(total_exec_time::numeric, 0)              AS total_ms,
       round(mean_exec_time::numeric, 2)               AS mean_ms,
       round(max_exec_time::numeric, 0)                AS max_ms,
       rows,
       shared_blks_hit, shared_blks_read,
       left(regexp_replace(query, '\s+', ' ', 'g'), 400) AS query
FROM extensions.pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 20;

\echo '=== 7. pg_stat_statements: top 20 por tiempo medio (calls >= 20)'
SELECT calls,
       round(mean_exec_time::numeric, 2)               AS mean_ms,
       round(total_exec_time::numeric, 0)              AS total_ms,
       rows,
       shared_blks_hit, shared_blks_read,
       left(regexp_replace(query, '\s+', ' ', 'g'), 400) AS query
FROM extensions.pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND calls >= 20
ORDER BY mean_exec_time DESC
LIMIT 20;

\echo '=== 8. Calidad de datos para keyset (deben ser 0 o hay que decidir antes de la Fase 1)'
SELECT 'bets.created_at NULL'            AS chequeo, count(*) FROM bets            WHERE created_at IS NULL
UNION ALL SELECT 'bets.bet_order NULL',             count(*) FROM bets            WHERE bet_order IS NULL
UNION ALL SELECT 'tickets.created_at NULL',         count(*) FROM tickets         WHERE created_at IS NULL
UNION ALL SELECT 'bets_archive.created_at NULL',    count(*) FROM bets_archive    WHERE created_at IS NULL
UNION ALL SELECT 'bets_archive.bet_order NULL',     count(*) FROM bets_archive    WHERE bet_order IS NULL
UNION ALL SELECT 'tickets_archive.created_at NULL', count(*) FROM tickets_archive WHERE created_at IS NULL;

\echo '=== 9. Volumen por organización y día (tablas activas) — define la profundidad de scroll'
SELECT organization_id, date, count(*) AS bets,
       count(DISTINCT ticket_id) AS tickets,
       max(cnt_same_ts)          AS max_empates_created_at
FROM (
  SELECT organization_id, date, ticket_id,
         count(*) OVER (PARTITION BY organization_id, date, created_at) AS cnt_same_ts
  FROM bets
  WHERE deleted_at IS NULL
) b
GROUP BY organization_id, date
ORDER BY bets DESC
LIMIT 15;

\echo '=== 10. Volumen por día en el archivo (últimos 30 días archivados)'
SELECT date, count(*) AS bets, count(DISTINCT organization_id) AS orgs
FROM bets_archive
WHERE date >= current_date - 45
GROUP BY date
ORDER BY date DESC
LIMIT 30;

\echo '=== 11. Polla: jugadas por edición (top 10)'
SELECT polla_edition_id, polla_organization_id,
       count(*)                                   AS jugadas,
       count(*) FILTER (WHERE deleted_at IS NULL) AS activas,
       count(DISTINCT cashier_polla_user_id)      AS pasadores
FROM polla_bets
GROUP BY polla_edition_id, polla_organization_id
ORDER BY jugadas DESC
LIMIT 10;

\echo '=== 12. Polla: formatos de ticket_number (valida la columna generada ticket_stamp)'
SELECT CASE
         WHEN ticket_number ~ '^\d+-\d{17}-\d+-\d+$' THEN '<grupo>-<17>-<pasador>-<jugador>'
         WHEN ticket_number ~ '^\d{17}-\d+$'         THEN '<17>-<pasador>'
         ELSE 'OTRO (revisar antes de la Fase 3)'
       END AS formato,
       count(*)
FROM polla_bets
GROUP BY 1
ORDER BY 2 DESC;

\echo '=== 13. Polla: tickets donde la primera corrida de 17 dígitos no es el stamp esperado (debe ser 0)'
SELECT count(*) AS inconsistentes
FROM polla_bets
WHERE substring(ticket_number FROM '[0-9]{17}') IS NULL
   OR (ticket_number ~ '^\d+-\d{17}-'
       AND substring(ticket_number FROM '[0-9]{17}') <> split_part(ticket_number, '-', 2));

RESET statement_timeout;
RESET default_transaction_read_only;
