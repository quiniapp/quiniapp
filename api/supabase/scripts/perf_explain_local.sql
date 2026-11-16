-- =============================================================================
-- perf_explain_local.sql — Planes de las queries calientes (SOLO LOCAL)
-- =============================================================================
-- Requiere el dataset de seed_perf.sql. Reproduce a mano el SQL que generan
-- PostgREST y las RPC, y muestra EXPLAIN (ANALYZE, BUFFERS) de cada uno.
-- Se re-corre antes/después de cada fase para comparar (gate de aceptación):
--   * sin `Sort` bajo `Limit` cuando hay índice alineado
--   * `Rows Removed by Filter` ≈ 0 en el acceso principal
--   * buffers de página profunda ≈ página 1
--
-- Uso:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -v confirm_local=yes -f api/supabase/scripts/perf_explain_local.sql > explain-local.txt
--
-- Las RPC se ven por dentro con auto_explain (Supabase local lo precarga):
-- los planes anidados salen como mensajes LOG.
-- =============================================================================

\set ON_ERROR_STOP on

\if :{?confirm_local}
\else
  \echo 'ABORTADO: falta -v confirm_local=yes (este script es solo para Supabase local).'
  \quit
\endif

\pset pager off

-- Parámetros tomados del dataset sembrado.
SELECT organization_id AS org FROM organizations WHERE name = 'perf-org-1' \gset
SELECT user_id AS cashier FROM users WHERE organization_id = :'org' AND number = 7 \gset
SELECT current_date AS day, current_date - 10 AS arch_day \gset
SELECT ticket_number AS tnum FROM tickets
WHERE organization_id = :'org' AND date = :'day' AND deleted_at IS NULL
ORDER BY created_at DESC, ticket_id DESC OFFSET 5000 LIMIT 1 \gset
SELECT polla_organization_id AS porg FROM polla_organizations WHERE name = 'perf-polla-1' \gset
SELECT polla_edition_id AS ped FROM polla_editions
WHERE polla_organization_id = :'porg' AND status = 'ACTIVE' \gset

-- Fila 10.000 del feed de Polla (orden ranking) para simular un cursor profundo.
SELECT hits AS c_hits, created_at AS c_created, polla_bet_id AS c_id,
       substring(ticket_number FROM '[0-9]{17}') AS pstamp
FROM polla_bets
WHERE polla_edition_id = :'ped' AND deleted_at IS NULL
ORDER BY hits DESC, created_at DESC, polla_bet_id DESC
OFFSET 10000 LIMIT 1 \gset

\echo ''
\echo '############################################################################'
\echo '# Q1  GET /bet — página 1 (PostgREST: *, lotteries(*), schedules(*); offset)'
\echo '############################################################################'
EXPLAIN (ANALYZE, BUFFERS)
SELECT b.*, row_to_json(l.*)::jsonb AS lotteries, row_to_json(s.*)::jsonb AS schedules
FROM bets b
LEFT JOIN LATERAL (SELECT * FROM lotteries l WHERE l.lottery_id = b.lottery_id) l ON TRUE
LEFT JOIN LATERAL (SELECT * FROM schedules s WHERE s.schedule_id = b.schedule_id) s ON TRUE
WHERE b.organization_id = :'org' AND b.date = :'day' AND b.deleted_at IS NULL
ORDER BY b.created_at DESC, b.bet_order ASC
LIMIT 50 OFFSET 0;

\echo '# Q1b GET /bet — count exact que PostgREST corre en cada página'
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM bets b
WHERE b.organization_id = :'org' AND b.date = :'day' AND b.deleted_at IS NULL;

\echo '# Q2  GET /bet — página 200 (OFFSET 9950)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT b.*, row_to_json(l.*)::jsonb AS lotteries, row_to_json(s.*)::jsonb AS schedules
FROM bets b
LEFT JOIN LATERAL (SELECT * FROM lotteries l WHERE l.lottery_id = b.lottery_id) l ON TRUE
LEFT JOIN LATERAL (SELECT * FROM schedules s WHERE s.schedule_id = b.schedule_id) s ON TRUE
WHERE b.organization_id = :'org' AND b.date = :'day' AND b.deleted_at IS NULL
ORDER BY b.created_at DESC, b.bet_order ASC
LIMIT 50 OFFSET 9950;

\echo '# Q3  GET /bet — filtro por pasador, página 1'
EXPLAIN (ANALYZE, BUFFERS)
SELECT b.*
FROM bets b
WHERE b.organization_id = :'org' AND b.date = :'day' AND b.deleted_at IS NULL
  AND b.user_id = :'cashier'
ORDER BY b.created_at DESC, b.bet_order ASC
LIMIT 50 OFFSET 0;

\echo '# Q4  GET /bet?ticket_number — hoy: consulta previa a tickets + bets por ticket_id'
EXPLAIN (ANALYZE, BUFFERS)
SELECT ticket_id FROM tickets WHERE ticket_number = :'tnum' AND organization_id = :'org';
EXPLAIN (ANALYZE, BUFFERS)
SELECT b.* FROM bets b
WHERE b.organization_id = :'org' AND b.date = :'day' AND b.deleted_at IS NULL
  AND b.ticket_id = (SELECT ticket_id FROM tickets WHERE ticket_number = :'tnum' AND organization_id = :'org')
ORDER BY b.created_at DESC, b.bet_order ASC
LIMIT 50;

\echo '# Q4b Variante propuesta (Fase 1): bets por ticket_number directo'
EXPLAIN (ANALYZE, BUFFERS)
SELECT b.* FROM bets b
WHERE b.organization_id = :'org' AND b.date = :'day' AND b.deleted_at IS NULL
  AND b.ticket_number = :'tnum'
ORDER BY b.created_at DESC, b.bet_order ASC
LIMIT 50;

\echo '# Q5  GET /ticket — página 1 (select *, orden solo created_at)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM tickets
WHERE organization_id = :'org' AND date = :'day' AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;

\echo '# Q5b GET /ticket — count exact'
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM tickets
WHERE organization_id = :'org' AND date = :'day' AND deleted_at IS NULL;

\echo '# Q5c GET /ticket — página 200 (OFFSET 9950)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM tickets
WHERE organization_id = :'org' AND date = :'day' AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50 OFFSET 9950;

\echo '# Q6  GET /bet en día archivado — página 1'
EXPLAIN (ANALYZE, BUFFERS)
SELECT b.* FROM bets_archive b
WHERE b.organization_id = :'org' AND b.date = :'arch_day' AND b.deleted_at IS NULL
ORDER BY b.created_at DESC, b.bet_order ASC
LIMIT 50 OFFSET 0;

\echo '# Q6b GET /ticket en día archivado — página 1'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM tickets_archive
WHERE organization_id = :'org' AND date = :'arch_day' AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;

\echo ''
\echo '############################################################################'
\echo '# Q7  Agrupadas + totales (página 1 de agrupadas = 4 RPC). Planes internos'
\echo '#     vía auto_explain (mensajes LOG).'
\echo '############################################################################'
SET auto_explain.log_min_duration = 0;
SET auto_explain.log_nested_statements = on;
SET auto_explain.log_analyze = on;
SET auto_explain.log_buffers = on;
SET client_min_messages = log;

\echo '# Q7a get_grouped_bets_for_parse (página 1)'
SELECT count(*) FROM get_grouped_bets_for_parse(:'day', NULL, NULL, NULL, false, :'org', NULL, 0, NULL, 50, 0);
\echo '# Q7b get_grouped_bets_count'
SELECT * FROM get_grouped_bets_count(:'day', NULL, NULL, NULL, false, :'org', NULL, 0, NULL);
\echo '# Q7c get_bets_total_amount'
SELECT * FROM get_bets_total_amount(ARRAY[:'org']::uuid[], :'day', NULL, NULL, NULL, NULL);
\echo '# Q7d get_bets_total_prize'
SELECT * FROM get_bets_total_prize(ARRAY[:'org']::uuid[], :'day', NULL, NULL, NULL, NULL);

\echo ''
\echo '############################################################################'
\echo '# Q9  Polla: cuentas por edición (polla_edition_account_base)'
\echo '############################################################################'
SELECT count(*) FROM polla_edition_account_rows(:'porg', :'ped', NULL, NULL);

\echo '# Q10 Polla: ventas del día (polla_daily_sales)'
SELECT count(*) FROM polla_daily_sales(:'porg', NULL, NULL, NULL, :'ped');

RESET client_min_messages;
RESET auto_explain.log_min_duration;

\echo ''
\echo '############################################################################'
\echo '# Q8  Polla: feed de jugadas'
\echo '############################################################################'
\echo '# Q8a ranking — página 1'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM polla_bets
WHERE polla_edition_id = :'ped' AND deleted_at IS NULL
ORDER BY hits DESC, created_at DESC, polla_bet_id DESC
LIMIT 51;

\echo '# Q8b ranking — cursor en la fila 10.000 (hoy: OR puro)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM polla_bets
WHERE polla_edition_id = :'ped' AND deleted_at IS NULL
  AND (hits < :c_hits
       OR (hits = :c_hits AND created_at < :'c_created')
       OR (hits = :c_hits AND created_at = :'c_created' AND polla_bet_id < :'c_id'))
ORDER BY hits DESC, created_at DESC, polla_bet_id DESC
LIMIT 51;

\echo '# Q8c ranking — cursor profundo con acceso redundante hits <= H (propuesta Fase 3)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM polla_bets
WHERE polla_edition_id = :'ped' AND deleted_at IS NULL
  AND hits <= :c_hits
  AND (hits < :c_hits
       OR (hits = :c_hits AND created_at < :'c_created')
       OR (hits = :c_hits AND created_at = :'c_created' AND polla_bet_id < :'c_id'))
ORDER BY hits DESC, created_at DESC, polla_bet_id DESC
LIMIT 51;

\echo '# Q8d ranking — row values (referencia: lo que haría una RPC)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM polla_bets
WHERE polla_edition_id = :'ped' AND deleted_at IS NULL
  AND (hits, created_at, polla_bet_id) < (:c_hits, :'c_created'::timestamptz, :'c_id'::uuid)
ORDER BY hits DESC, created_at DESC, polla_bet_id DESC
LIMIT 51;

\echo '# Q8e recientes — cursor profundo (OR puro)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM polla_bets
WHERE polla_edition_id = :'ped' AND deleted_at IS NULL
  AND (created_at < :'c_created'
       OR (created_at = :'c_created' AND polla_bet_id < :'c_id'))
ORDER BY created_at DESC, polla_bet_id DESC
LIMIT 51;

\echo '# Q11 Polla: Revisar ticket con 17 dígitos (hoy: 2 LIKE, uno con comodín inicial)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM polla_bets
WHERE polla_organization_id = :'porg'
  AND (ticket_number LIKE :'pstamp' || '-%' OR ticket_number LIKE '%-' || :'pstamp' || '-%')
ORDER BY created_at DESC
LIMIT 100;
