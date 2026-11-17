-- =============================================================================
-- perf_stats_snapshot.sql — Foto de contadores acumulados (SOLO LECTURA)
-- =============================================================================
-- pg_stat_statements y pg_stat_user_* acumulan desde el último reset (en prod:
-- 2025-09-16). Para ver el estado ACTUAL, sin resetear nada, se toman dos fotos
-- (T0 y T1, con >= 24 h de uso normal en el medio: un día hábil completo con
-- carga de resultados y archivado) y se comparan con perf_stats_diff.ts.
--
-- Uso (desde la raíz del repo):
--   psql "<pooler URI>" -f api/supabase/scripts/perf_stats_snapshot.sql > stats-T0.csv
--   ... >= 24 h ...
--   psql "<pooler URI>" -f api/supabase/scripts/perf_stats_snapshot.sql > stats-T1.csv
--   npx tsx api/supabase/scripts/perf_stats_diff.ts stats-T0.csv stats-T1.csv
--
-- Salida: un CSV con columnas genéricas v1..v7 cuyo significado depende de `kind`
-- (perf_stats_diff.ts las nombra):
--   meta  object=captured_at|stmt_reset|db_reset   label=valor
--   stmt  v1 calls, v2 total_ms, v3 rows, v4 shared_blks_hit, v5 shared_blks_read   label=query
--   idx   v1 idx_scan, v2 idx_tup_read, v3 idx_tup_fetch, v4 idx_blks_hit, v5 idx_blks_read
--   tbl   v1 seq_scan, v2 seq_tup_read, v3 idx_scan, v4 n_tup_ins, v5 n_tup_upd,
--         v6 n_tup_hot_upd, v7 n_tup_del
-- =============================================================================

\set QUIET on
\set ON_ERROR_STOP on
\pset pager off
\pset format csv

SET default_transaction_read_only = on;
SET statement_timeout = '60s';

SELECT 'meta' AS kind, '' AS role, 'captured_at' AS object,
       NULL::numeric AS v1, NULL::numeric AS v2, NULL::numeric AS v3, NULL::numeric AS v4,
       NULL::numeric AS v5, NULL::numeric AS v6, NULL::numeric AS v7,
       now()::text AS label
UNION ALL
SELECT 'meta', '', 'stmt_reset', NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       stats_reset::text
FROM extensions.pg_stat_statements_info
UNION ALL
SELECT 'meta', '', 'db_reset', NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       coalesce(stats_reset::text, '')
FROM pg_stat_database
WHERE datname = current_database()
UNION ALL
SELECT 'stmt',
       s.userid::regrole::text,
       s.queryid::text || CASE WHEN s.toplevel THEN '' ELSE ':nested' END,
       s.calls, round(s.total_exec_time::numeric, 1), s.rows,
       s.shared_blks_hit, s.shared_blks_read, NULL, NULL,
       left(regexp_replace(s.query, '\s+', ' ', 'g'), 300)
FROM extensions.pg_stat_statements s
WHERE s.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
UNION ALL
SELECT 'idx', '', s.relname || '.' || s.indexrelname,
       s.idx_scan, s.idx_tup_read, s.idx_tup_fetch,
       io.idx_blks_hit, io.idx_blks_read, NULL, NULL,
       pg_size_pretty(pg_relation_size(s.indexrelid))
FROM pg_stat_user_indexes s
JOIN pg_statio_user_indexes io ON io.indexrelid = s.indexrelid
WHERE s.schemaname = 'public'
UNION ALL
SELECT 'tbl', '', relname,
       seq_scan, seq_tup_read, coalesce(idx_scan, 0),
       n_tup_ins, n_tup_upd, n_tup_hot_upd, n_tup_del,
       ''
FROM pg_stat_user_tables
WHERE schemaname = 'public';
