-- =============================================================================
-- seed_perf.sql — Dataset con volumen para medir planes de ejecución
-- =============================================================================
-- SOLO LOCAL. Nunca correr contra develop ni prod.
--
-- Uso (desde la raíz del repo, con Supabase local levantado):
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -v confirm_local=yes -f api/supabase/scripts/seed_perf.sql
--
-- Genera (aprox.):
--   QuiniApp: 4 organizaciones 'perf-org-N', 20 pasadores, 10 quinielas y
--             5 turnos por org.
--             tickets         200k  (2 días activos: hoy y ayer)
--             bets            1M    (5 por ticket, created_at compartido por
--                                    ticket → empates para probar desempates)
--             tickets_archive ~204k (30 días anteriores)
--             bets_archive    ~1M
--   Polla:    2 organizaciones 'perf-polla-N', 3 grupos, 30 pasadores,
--             300 jugadores y 3 ediciones por org.
--             polla_bets      300k  (50k por edición; pares con el mismo
--                                    created_at para probar desempates)
--
-- Es idempotente: borra primero todo lo sembrado antes (prefijo 'perf-').
-- Tarda unos minutos (mantenimiento de índices). Termina con ANALYZE.
-- =============================================================================

\set ON_ERROR_STOP on

\if :{?confirm_local}
\else
  \echo 'ABORTADO: falta -v confirm_local=yes (este script es solo para Supabase local).'
  \quit
\endif

\timing on

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Limpieza de una corrida anterior
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE perf_old_orgs ON COMMIT DROP AS
  SELECT organization_id FROM organizations WHERE name LIKE 'perf-org-%';

DELETE FROM bets_archive    WHERE organization_id IN (SELECT organization_id FROM perf_old_orgs);
DELETE FROM tickets_archive WHERE organization_id IN (SELECT organization_id FROM perf_old_orgs);
DELETE FROM bets            WHERE organization_id IN (SELECT organization_id FROM perf_old_orgs);
DELETE FROM tickets         WHERE organization_id IN (SELECT organization_id FROM perf_old_orgs);
DELETE FROM users           WHERE organization_id IN (SELECT organization_id FROM perf_old_orgs);
DELETE FROM lotteries       WHERE organization_id IN (SELECT organization_id FROM perf_old_orgs);
DELETE FROM schedules       WHERE organization_id IN (SELECT organization_id FROM perf_old_orgs);
DELETE FROM organizations   WHERE organization_id IN (SELECT organization_id FROM perf_old_orgs);

CREATE TEMP TABLE perf_old_polla_orgs ON COMMIT DROP AS
  SELECT polla_organization_id FROM polla_organizations WHERE name LIKE 'perf-polla-%';

-- Tablas que la app pudo haber llenado si se usó el dataset desde la UI.
DELETE FROM polla_credit_movements          WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_current_accounts          WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_edition_account_movements WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_edition_liquidations      WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_group_edition_accounts    WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_group_accounts            WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_org_expenses              WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_results                   WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_sessions                  WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_bets      WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_editions  WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_users     WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs)
                              AND user_type = 'PLAYER';
DELETE FROM polla_users     WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_groups    WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_lotteries WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_schedules WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);
DELETE FROM polla_organizations WHERE polla_organization_id IN (SELECT polla_organization_id FROM perf_old_polla_orgs);

-- -----------------------------------------------------------------------------
-- 1. QuiniApp: catálogos
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE perf_orgs ON COMMIT DROP AS
  SELECT gen_random_uuid() AS organization_id,
         gen_random_uuid() AS group_id,
         o AS org_idx
  FROM generate_series(1, 4) AS o;

INSERT INTO organizations (organization_id, name)
SELECT organization_id, 'perf-org-' || org_idx FROM perf_orgs;

CREATE TEMP TABLE perf_cashiers ON COMMIT DROP AS
  SELECT gen_random_uuid() AS user_id, o.organization_id, o.group_id, o.org_idx,
         c AS number, 'Pasador ' || c AS name
  FROM perf_orgs o CROSS JOIN generate_series(1, 20) AS c;

INSERT INTO users (user_id, number, user_type, name, username, group_id,
                   cashier_type, fee, fee_plus, organization_id)
SELECT user_id, number, 'CASHIER', name,
       'perf-' || org_idx || '-' || number, group_id,
       'PC', 10, 0, organization_id
FROM perf_cashiers;

CREATE TEMP TABLE perf_lotteries ON COMMIT DROP AS
  SELECT gen_random_uuid() AS lottery_id, o.organization_id, l AS idx
  FROM perf_orgs o CROSS JOIN generate_series(1, 10) AS l;

INSERT INTO lotteries (lottery_id, name, organization_id, "order")
SELECT lottery_id, 'Quiniela ' || idx, organization_id, idx FROM perf_lotteries;

CREATE TEMP TABLE perf_schedules ON COMMIT DROP AS
  SELECT gen_random_uuid() AS schedule_id, o.organization_id, s AS idx
  FROM perf_orgs o CROSS JOIN generate_series(1, 5) AS s;

INSERT INTO schedules (schedule_id, name, time, organization_id)
SELECT schedule_id, 'Turno ' || idx, time '10:00' + (idx * interval '2 hours'), organization_id
FROM perf_schedules;

-- Catálogo por org en arrays, para elegir quiniela/turno/pasador al azar por fila.
CREATE TEMP TABLE perf_org_catalog ON COMMIT DROP AS
  SELECT o.organization_id, o.org_idx,
         (SELECT array_agg(lottery_id ORDER BY idx) FROM perf_lotteries l WHERE l.organization_id = o.organization_id) AS lot_ids,
         (SELECT array_agg(schedule_id ORDER BY idx) FROM perf_schedules s WHERE s.organization_id = o.organization_id) AS sch_ids,
         (SELECT array_agg(user_id ORDER BY number) FROM perf_cashiers c WHERE c.organization_id = o.organization_id) AS cashier_ids
  FROM perf_orgs o;

-- -----------------------------------------------------------------------------
-- 2. QuiniApp: tickets + bets (tablas activas: hoy y ayer, 25k tickets/org/día)
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE perf_tickets_main ON COMMIT DROP AS
  SELECT gen_random_uuid() AS ticket_id,
         oc.organization_id,
         d.day,
         g.i,
         oc.cashier_ids[1 + (g.i % 20)] AS user_id,
         1 + (g.i % 20) AS cashier_number,
         -- Segundos truncados: varios tickets comparten created_at (empates reales).
         date_trunc('second', d.day + time '08:00' + ((g.i / 3) * interval '5 seconds')) AS created_at,
         (random() < 0.02) AS is_deleted
  FROM perf_org_catalog oc
  CROSS JOIN (VALUES (current_date), (current_date - 1)) AS d(day)
  CROSS JOIN generate_series(1, 25000) AS g(i);

INSERT INTO tickets (ticket_id, user_id, user_name, ticket_number, date, total,
                     created_at, deleted_at, organization_id)
SELECT t.ticket_id, t.user_id, 'Pasador ' || t.cashier_number,
       to_char(t.day, 'YYMMDD') || lpad(t.i::text, 6, '0') || '-' || t.cashier_number,
       t.day, 0, t.created_at,
       CASE WHEN t.is_deleted THEN t.created_at + interval '5 minutes' END,
       t.organization_id
FROM perf_tickets_main t;

INSERT INTO bets (bet_id, bet_type, ticket_id, user_id, number, amount, place, date,
                  winner, prize, lottery_id, schedule_id, created_at, ticket_number,
                  cashier_name, bet_order, organization_id, deleted_at)
SELECT gen_random_uuid(),
       (ARRAY['ONE','DOUBLE','TERN','QUATERN']::bet_type_enum[])[1 + (o % 4)],
       t.ticket_id, t.user_id,
       lpad(((t.i * 7 + o * 13) % (10 ^ (1 + (o % 4)))::int)::text, 1 + (o % 4), '0'),
       (ARRAY[100, 200, 500, 1000])[1 + ((t.i + o) % 4)],
       (ARRAY['HEAD','FIVE','TEN','TWENTY']::place_type_enum[])[1 + ((t.i + o) % 4)],
       t.day,
       w.winner,
       CASE WHEN w.winner THEN 7000 ELSE 0 END,
       oc.lot_ids[1 + ((t.i + o) % 10)],
       oc.sch_ids[1 + ((t.i * 3 + o) % 5)],
       t.created_at,
       to_char(t.day, 'YYMMDD') || lpad(t.i::text, 6, '0') || '-' || t.cashier_number,
       'Pasador ' || t.cashier_number,
       o,
       t.organization_id,
       CASE WHEN t.is_deleted THEN t.created_at + interval '5 minutes' END
FROM perf_tickets_main t
JOIN perf_org_catalog oc USING (organization_id)
CROSS JOIN generate_series(0, 4) AS o
-- random() referencia una columna externa para evaluarse por fila.
CROSS JOIN LATERAL (SELECT (random() + 0 * o) < 0.03 AS winner) AS w;

UPDATE tickets t
SET total = s.total,
    total_prize = s.total_prize,
    winner = s.winner,
    hits = s.hits
FROM (
  SELECT ticket_id,
         SUM(amount) AS total,
         COALESCE(SUM(prize) FILTER (WHERE winner), 0) AS total_prize,
         bool_or(winner) AS winner,
         COUNT(*) FILTER (WHERE winner)::int AS hits
  FROM bets
  WHERE organization_id IN (SELECT organization_id FROM perf_orgs)
  GROUP BY ticket_id
) s
WHERE t.ticket_id = s.ticket_id;

-- -----------------------------------------------------------------------------
-- 3. QuiniApp: archivo (30 días anteriores, ~1.7k tickets/org/día)
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE perf_tickets_archive ON COMMIT DROP AS
  SELECT gen_random_uuid() AS ticket_id,
         oc.organization_id,
         d.day,
         g.i,
         oc.cashier_ids[1 + (g.i % 20)] AS user_id,
         1 + (g.i % 20) AS cashier_number,
         date_trunc('second', d.day + time '08:00' + ((g.i / 2) * interval '50 seconds')) AS created_at,
         (random() < 0.02) AS is_deleted
  FROM perf_org_catalog oc
  CROSS JOIN (SELECT gs::date AS day
              FROM generate_series(current_date - 31, current_date - 2, interval '1 day') AS gs) AS d
  CROSS JOIN generate_series(1, 1700) AS g(i);

INSERT INTO bets_archive (bet_id, bet_type, ticket_id, user_id, number, amount, place, date,
                          winner, prize, lottery_id, schedule_id, created_at, ticket_number,
                          cashier_name, bet_order, organization_id, deleted_at)
SELECT gen_random_uuid(),
       (ARRAY['ONE','DOUBLE','TERN','QUATERN']::bet_type_enum[])[1 + (o % 4)],
       t.ticket_id, t.user_id,
       lpad(((t.i * 7 + o * 13) % (10 ^ (1 + (o % 4)))::int)::text, 1 + (o % 4), '0'),
       (ARRAY[100, 200, 500, 1000])[1 + ((t.i + o) % 4)],
       (ARRAY['HEAD','FIVE','TEN','TWENTY']::place_type_enum[])[1 + ((t.i + o) % 4)],
       t.day,
       w.winner,
       CASE WHEN w.winner THEN 7000 ELSE 0 END,
       oc.lot_ids[1 + ((t.i + o) % 10)],
       oc.sch_ids[1 + ((t.i * 3 + o) % 5)],
       t.created_at,
       to_char(t.day, 'YYMMDD') || lpad(t.i::text, 6, '0') || '-' || t.cashier_number,
       'Pasador ' || t.cashier_number,
       o,
       t.organization_id,
       CASE WHEN t.is_deleted THEN t.created_at + interval '5 minutes' END
FROM perf_tickets_archive t
JOIN perf_org_catalog oc USING (organization_id)
CROSS JOIN generate_series(0, 4) AS o
-- random() referencia una columna externa para evaluarse por fila.
CROSS JOIN LATERAL (SELECT (random() + 0 * o) < 0.03 AS winner) AS w;

INSERT INTO tickets_archive (ticket_id, user_id, user_name, ticket_number, date, total,
                             total_prize, winner, hits, created_at, deleted_at, organization_id)
SELECT t.ticket_id, t.user_id, 'Pasador ' || t.cashier_number,
       to_char(t.day, 'YYMMDD') || lpad(t.i::text, 6, '0') || '-' || t.cashier_number,
       t.day, s.total, s.total_prize, s.winner, s.hits, t.created_at,
       CASE WHEN t.is_deleted THEN t.created_at + interval '5 minutes' END,
       t.organization_id
FROM perf_tickets_archive t
JOIN (
  SELECT ticket_id,
         SUM(amount) AS total,
         COALESCE(SUM(prize) FILTER (WHERE winner), 0) AS total_prize,
         bool_or(winner) AS winner,
         COUNT(*) FILTER (WHERE winner)::int AS hits
  FROM bets_archive
  WHERE organization_id IN (SELECT organization_id FROM perf_orgs)
  GROUP BY ticket_id
) s USING (ticket_id);

-- -----------------------------------------------------------------------------
-- 4. Polla: catálogos, usuarios y ediciones
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE perf_polla_orgs ON COMMIT DROP AS
  SELECT gen_random_uuid() AS polla_organization_id,
         gen_random_uuid() AS polla_lottery_id,
         gen_random_uuid() AS polla_schedule_id,
         o AS org_idx
  FROM generate_series(1, 2) AS o;

INSERT INTO polla_organizations (polla_organization_id, name)
SELECT polla_organization_id, 'perf-polla-' || org_idx FROM perf_polla_orgs;

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
SELECT polla_lottery_id, polla_organization_id, 'Nacional' FROM perf_polla_orgs;

INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
SELECT polla_schedule_id, polla_organization_id, 'Nocturna', time '21:00' FROM perf_polla_orgs;

CREATE TEMP TABLE perf_polla_groups ON COMMIT DROP AS
  SELECT gen_random_uuid() AS polla_group_id, o.polla_organization_id, o.org_idx, g AS number
  FROM perf_polla_orgs o CROSS JOIN generate_series(1, 3) AS g;

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number)
SELECT polla_group_id, polla_organization_id, 'Grupo ' || number, number FROM perf_polla_groups;

-- 10 pasadores por grupo (número único por org + grupo).
CREATE TEMP TABLE perf_polla_cashiers ON COMMIT DROP AS
  SELECT gen_random_uuid() AS polla_user_id, g.polla_organization_id, g.org_idx,
         g.polla_group_id, g.number AS group_number, c AS number,
         row_number() OVER (PARTITION BY g.polla_organization_id ORDER BY g.number, c) AS cashier_idx
  FROM perf_polla_groups g CROSS JOIN generate_series(1, 10) AS c;

INSERT INTO polla_users (polla_user_id, number, user_type, name, polla_organization_id,
                         polla_group_id, fee, fee_plus)
SELECT polla_user_id, number, 'CASHIER', 'Pasador ' || group_number || '-' || number,
       polla_organization_id, polla_group_id, 10, 0
FROM perf_polla_cashiers;

-- 10 jugadores por pasador.
CREATE TEMP TABLE perf_polla_players ON COMMIT DROP AS
  SELECT gen_random_uuid() AS polla_user_id, c.polla_organization_id, c.polla_group_id,
         c.polla_user_id AS cashier_id, c.number AS cashier_number, c.group_number,
         p AS number,
         row_number() OVER (PARTITION BY c.polla_organization_id ORDER BY c.cashier_idx, p) AS player_idx
  FROM perf_polla_cashiers c CROSS JOIN generate_series(1, 10) AS p;

INSERT INTO polla_users (polla_user_id, number, user_type, name, polla_organization_id,
                         polla_group_id, parent_polla_user_id)
SELECT polla_user_id, number, 'PLAYER', 'Jugador ' || group_number || '-' || cashier_number || '-' || number,
       polla_organization_id, polla_group_id, cashier_id
FROM perf_polla_players;

-- 3 ediciones por org: dos terminadas y una activa.
CREATE TEMP TABLE perf_polla_editions ON COMMIT DROP AS
  SELECT gen_random_uuid() AS polla_edition_id, o.polla_organization_id, o.org_idx,
         o.polla_lottery_id, o.polla_schedule_id, e AS ed_idx,
         (current_date - (3 - e) * 14 - 7) AS start_date
  FROM perf_polla_orgs o CROSS JOIN generate_series(1, 3) AS e;

INSERT INTO polla_editions (polla_edition_id, polla_organization_id, polla_lottery_id,
                            polla_schedule_id, name, start_date, end_date, load_limit_date,
                            pool_amount, ticket_price, status, load_start_date, load_start_time)
SELECT polla_edition_id, polla_organization_id, polla_lottery_id, polla_schedule_id,
       'Perf edición ' || ed_idx, start_date, start_date + 13, start_date - 1,
       1000000, 1000,
       CASE WHEN ed_idx = 3 THEN 'ACTIVE' ELSE 'FINISHED' END::polla_edition_status_enum,
       start_date - 7, time '00:00'
FROM perf_polla_editions;

-- -----------------------------------------------------------------------------
-- 5. Polla: jugadas (50k por edición)
-- -----------------------------------------------------------------------------
-- Ticket con formato actual: <grupo>-<17 dígitos>-<pasador>-<jugador>.
-- Los pares de i comparten created_at (empates); el jugador distinto mantiene
-- único el ticket_number.
INSERT INTO polla_bets (ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id,
                        polla_organization_id, polla_group_id, user_name, cashier_name,
                        cashier_number, load_date, amount, numbers, hits, winner, prize,
                        created_at, deleted_at, identifier)
SELECT pl.group_number || '-'
         || to_char(b.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYYMMDDHH24MISSMS')
         || '-' || pl.cashier_number || '-' || pl.number,
       e.polla_edition_id, pl.polla_user_id, pl.cashier_id,
       e.polla_organization_id, pl.polla_group_id,
       'Jugador ' || pl.group_number || '-' || pl.cashier_number || '-' || pl.number,
       'Pasador ' || pl.group_number || '-' || pl.cashier_number,
       pl.cashier_number,
       (b.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
       1000,
       ARRAY(SELECT lpad(((g.i * 31 + k * 17 + e.ed_idx) % 100)::text, 2, '0')
             FROM generate_series(1, 10) AS k),
       h.hits,
       h.hits >= 10,
       CASE WHEN h.hits >= 10 THEN 50000 ELSE 0 END,
       b.created_at,
       CASE WHEN random() < 0.01 THEN b.created_at + interval '10 minutes' END,
       CASE WHEN g.i % 10 = 0 THEN 'cliente ' || (g.i % 997) END
FROM perf_polla_editions e
CROSS JOIN generate_series(1, 50000) AS g(i)
JOIN perf_polla_players pl
  ON pl.polla_organization_id = e.polla_organization_id
 AND pl.player_idx = 1 + (g.i % 300)
CROSS JOIN LATERAL (
  SELECT ((e.start_date - 7)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
         + ((g.i / 2) * interval '20 seconds')
         + (e.org_idx * interval '1 millisecond') AS created_at
) AS b
CROSS JOIN LATERAL (
  SELECT LEAST(10, floor(random() * random() * 12 + 0 * g.i))::int AS hits
) AS h;

UPDATE polla_editions e
SET bets_count = s.cnt,
    collected_amount = s.total
FROM (
  SELECT polla_edition_id, COUNT(*)::int AS cnt, SUM(amount) AS total
  FROM polla_bets
  WHERE deleted_at IS NULL
    AND polla_organization_id IN (SELECT polla_organization_id FROM perf_polla_orgs)
  GROUP BY polla_edition_id
) s
WHERE e.polla_edition_id = s.polla_edition_id;

COMMIT;

-- -----------------------------------------------------------------------------
-- 6. Estadísticas
-- -----------------------------------------------------------------------------
ANALYZE organizations, users, lotteries, schedules,
        tickets, bets, tickets_archive, bets_archive,
        polla_organizations, polla_groups, polla_users, polla_editions, polla_bets;

SELECT 'tickets' AS tabla, COUNT(*) FROM tickets
UNION ALL SELECT 'bets', COUNT(*) FROM bets
UNION ALL SELECT 'tickets_archive', COUNT(*) FROM tickets_archive
UNION ALL SELECT 'bets_archive', COUNT(*) FROM bets_archive
UNION ALL SELECT 'polla_bets', COUNT(*) FROM polla_bets;
