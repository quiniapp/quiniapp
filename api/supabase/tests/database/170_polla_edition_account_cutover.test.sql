-- Cuenta por edición: el corte de la migración decide qué ediciones quedan
-- por días (terminaron y todo está liquidado) y cuáles pasan a liquidarse
-- por edición. Una edición por días no acepta movimientos ni gastos, y
-- procesar resultados, cargar y borrar tickets o borrar una edición ya no
-- tocan la cuenta por días. El historial por fechas no suma los gastos por
-- edición.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-000000000170', 'pgTAP corte cuenta');

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, fee, fee_plus)
SELECT ('a9000000-0000-0000-0000-00000170c00' || n)::UUID, 'CASHIER', 'Pasador ' || n, n,
       'a9000000-0000-0000-0000-000000000170', 10, 0
FROM generate_series(1, 5) n;
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a9000000-0000-0000-0000-00000170d001', 'OWNER', 'Dueño corte', 'a9000000-0000-0000-0000-000000000170');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000170a001', 'a9000000-0000-0000-0000-000000000170', 'Nacional corte');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a9000000-0000-0000-0000-00000170b001', 'a9000000-0000-0000-0000-000000000170', 'Nocturna corte', '21:00');

-- Se crean a futuro (el cierre de carga rechaza fechas pasadas) y después se
-- mueven al pasado.
CREATE TEMP TABLE eds (name TEXT PRIMARY KEY, id UUID NOT NULL);

CREATE FUNCTION pg_temp.edition(p_name TEXT, p_end_offset INTEGER) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := (polla_create_edition(
    'a9000000-0000-0000-0000-000000000170',
    jsonb_build_object(
      'name', p_name, 'start_date', polla_today() + 1, 'end_date', polla_today() + 5,
      'load_limit_date', polla_today() + 1, 'load_limit_time', '20:00',
      'pool_amount', 1000, 'ticket_price', 100
    ),
    jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', 'a9000000-0000-0000-0000-00000170a001',
      'polla_schedule_id', 'a9000000-0000-0000-0000-00000170b001'))
  )->>'polla_edition_id')::UUID;
  UPDATE polla_editions
  SET load_start_date = polla_today() - 20, load_limit_date = polla_today() - 12,
      start_date = polla_today() - 10, end_date = polla_today() + p_end_offset
  WHERE polla_edition_id = v_id;
  INSERT INTO eds VALUES (p_name, v_id);
END;
$$;

CREATE FUNCTION pg_temp.ed(p_name TEXT) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM eds WHERE name = p_name;
$$;

CREATE FUNCTION pg_temp.cashier(p_n INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT ('a9000000-0000-0000-0000-00000170c00' || p_n)::UUID;
$$;

CREATE FUNCTION pg_temp.bet(p_edition TEXT, p_cashier INTEGER, p_ticket TEXT, p_load DATE,
                            p_deleted_at TIMESTAMPTZ DEFAULT NULL, p_deducted DATE DEFAULT NULL) RETURNS VOID
LANGUAGE sql AS $$
  INSERT INTO polla_bets (
    ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id, polla_organization_id,
    user_name, cashier_name, cashier_number, load_date, amount, numbers, deleted_at, deducted_on
  ) VALUES (
    p_ticket, pg_temp.ed(p_edition), pg_temp.cashier(p_cashier), pg_temp.cashier(p_cashier),
    'a9000000-0000-0000-0000-000000000170', 'Pasador ' || p_cashier, 'Pasador ' || p_cashier, p_cashier,
    p_load, 100, ARRAY['01','02','03','04','05','06','07','08','09','10'], p_deleted_at, p_deducted
  );
$$;

-- Última liquidación por días del pasador.
CREATE FUNCTION pg_temp.liquidated(p_cashier INTEGER, p_date DATE) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO polla_current_accounts (polla_user_id, user_name, user_number, polla_organization_id, date, is_liquidated)
  VALUES (pg_temp.cashier(p_cashier), 'Pasador ' || p_cashier, p_cashier,
          'a9000000-0000-0000-0000-000000000170', p_date, TRUE);
$$;

-- E1: terminó ayer, todo liquidado por días → queda por días.
SELECT pg_temp.edition('E1', -1);
SELECT pg_temp.bet('E1', 1, 'T-E1', polla_today() - 3);
SELECT pg_temp.liquidated(1, polla_today() - 1);
-- E2: terminó ayer, un ticket posterior a la última liquidación → por edición.
SELECT pg_temp.edition('E2', -1);
SELECT pg_temp.bet('E2', 2, 'T-E2', polla_today() - 2);
SELECT pg_temp.liquidated(2, polla_today() - 3);
-- E3: terminó ayer, ticket borrado con deducted_on posterior → por edición.
SELECT pg_temp.edition('E3', -1);
SELECT pg_temp.bet('E3', 3, 'T-E3', polla_today() - 5, NOW(), polla_today() - 2);
SELECT pg_temp.liquidated(3, polla_today() - 3);
-- E4: terminó ayer, su pasador nunca se liquidó → por edición.
SELECT pg_temp.edition('E4', -1);
SELECT pg_temp.bet('E4', 4, 'T-E4', polla_today() - 5);
-- E5: termina hoy (en sorteo) → por edición, aunque su ticket ya esté
-- liquidado por días: no hay exclusión automática, se ajusta a mano con un
-- reclamo negativo (decisión del 14/11; lo calcula
-- api/supabase/scripts/polla_edition_account_cutover_preview.sql).
SELECT pg_temp.edition('E5', 0);
SELECT pg_temp.bet('E5', 5, 'T-E5', polla_today() - 5);
SELECT pg_temp.liquidated(5, polla_today() - 1);

CREATE TEMP TABLE accounts_before AS
SELECT count(*) AS n FROM polla_current_accounts;

SELECT is(polla_edition_account_cutover('a9000000-0000-0000-0000-000000000170'), 1, 'cambia solo una edición');
SELECT is((SELECT account_by_edition FROM polla_editions WHERE polla_edition_id = pg_temp.ed('E1')), FALSE,
  'liquidada por días: queda por días');
SELECT is((SELECT account_by_edition FROM polla_editions WHERE polla_edition_id = pg_temp.ed('E2')), TRUE,
  'ticket sin liquidar: por edición');
SELECT is((SELECT account_by_edition FROM polla_editions WHERE polla_edition_id = pg_temp.ed('E3')), TRUE,
  'borrada sin liquidar: por edición');
SELECT is((SELECT account_by_edition FROM polla_editions WHERE polla_edition_id = pg_temp.ed('E4')), TRUE,
  'pasador nunca liquidado: por edición');
SELECT is((SELECT account_by_edition FROM polla_editions WHERE polla_edition_id = pg_temp.ed('E5')), TRUE,
  'en sorteo: por edición');

SELECT throws_ok(
  $$INSERT INTO polla_edition_account_movements (polla_organization_id, polla_edition_id, polla_user_id, type, amount)
    VALUES ('a9000000-0000-0000-0000-000000000170', pg_temp.ed('E1'), pg_temp.cashier(1), 'COLLECTION', 100)$$,
  'P0001', 'POLLA_EDITION_ACCOUNT_DISABLED', 'una edición por días no acepta movimientos');
SELECT throws_ok(
  $$INSERT INTO polla_edition_account_movements (polla_organization_id, polla_edition_id, polla_user_id, type, amount)
    VALUES ('a9000000-0000-0000-0000-000000000170', pg_temp.ed('E2'), 'a9000000-0000-0000-0000-00000170d001', 'COLLECTION', 100)$$,
  'P0001', 'POLLA_ACCOUNT_USER_NOT_CASHIER', 'solo pasadores');
SELECT throws_ok(
  $$INSERT INTO polla_edition_account_movements (polla_organization_id, polla_edition_id, polla_user_id, type, amount)
    VALUES ('a9000000-0000-0000-0000-000000000170', pg_temp.ed('E2'), pg_temp.cashier(2), 'COLLECTION', -5)$$,
  '23514', NULL, 'un cobro es positivo');
SELECT lives_ok(
  $$INSERT INTO polla_edition_account_movements (polla_organization_id, polla_edition_id, polla_user_id, type, amount)
    VALUES ('a9000000-0000-0000-0000-000000000170', pg_temp.ed('E2'), pg_temp.cashier(2), 'CLAIM', -50)$$,
  'un reclamo puede ser negativo');
SELECT throws_ok(
  $$INSERT INTO polla_org_expenses (polla_organization_id, date, name, amount, polla_edition_id)
    VALUES ('a9000000-0000-0000-0000-000000000170', polla_today(), 'Gasto', 10, pg_temp.ed('E1'))$$,
  'P0001', 'POLLA_EDITION_ACCOUNT_DISABLED', 'gasto en una edición por días');

SELECT ok(
  polla_recalculate_accounts_on('a9000000-0000-0000-0000-000000000170', ARRAY[polla_today()]) = 0
  AND (SELECT count(*) FROM polla_current_accounts) = (SELECT n FROM accounts_before),
  'procesar resultados ya no recalcula por días');

-- ------------------------------------- tickets y la cuenta por días

-- Cantidad y md5 de todas las filas por días.
CREATE FUNCTION pg_temp.daily_md5() RETURNS TEXT LANGUAGE sql AS $$
  SELECT count(*) || ':' || COALESCE(md5(string_agg(ca::TEXT, '|' ORDER BY ca.polla_current_account_id)), '')
  FROM polla_current_accounts ca;
$$;

-- Una edición en carga y una fila de hoy del pasador 1 sin liquidar y todavía
-- sin jugadas (antes del corte, cargar o borrar un ticket la recalculaba).
CREATE TEMP TABLE e6 AS
SELECT (polla_create_edition(
  'a9000000-0000-0000-0000-000000000170',
  jsonb_build_object(
    'name', 'E6', 'start_date', polla_today() + 10, 'end_date', polla_today() + 15,
    'load_limit_date', polla_today() + 9, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ),
  jsonb_build_array(jsonb_build_object(
    'polla_lottery_id', 'a9000000-0000-0000-0000-00000170a001',
    'polla_schedule_id', 'a9000000-0000-0000-0000-00000170b001'))
)->>'polla_edition_id')::UUID AS id;
INSERT INTO polla_current_accounts (polla_user_id, user_name, user_number, polla_organization_id, date, is_liquidated)
VALUES (pg_temp.cashier(1), 'Pasador 1', 1, 'a9000000-0000-0000-0000-000000000170', polla_today(), FALSE);
CREATE TEMP TABLE daily_before AS SELECT pg_temp.daily_md5() AS h;

CREATE TEMP TABLE e6_bet AS
SELECT (polla_create_bet(
  (SELECT id FROM e6), pg_temp.cashier(1), pg_temp.cashier(1),
  ARRAY['01','02','03','04','05','06','07','08','09','10'], NULL, FALSE, FALSE, NULL, 'corte', 'OWED'
)->'bet'->>'polla_bet_id')::UUID AS id;
SELECT is(pg_temp.daily_md5(), (SELECT h FROM daily_before), 'cargar un ticket no toca la cuenta por días');

SELECT polla_delete_bet((SELECT id FROM e6_bet), 'a9000000-0000-0000-0000-00000170d001');
SELECT is(pg_temp.daily_md5(), (SELECT h FROM daily_before), 'borrar un ticket tampoco');

SELECT polla_create_bet(
  (SELECT id FROM e6), pg_temp.cashier(1), pg_temp.cashier(1),
  ARRAY['11','12','13','14','15','16','17','18','19','20'], NULL, FALSE, FALSE, NULL, 'corte 2', 'OWED'
);
SELECT polla_delete_edition((SELECT id FROM e6), 'a9000000-0000-0000-0000-00000170d001');
SELECT is(pg_temp.daily_md5(), (SELECT h FROM daily_before), 'ni borrar la edición (anula sus tickets)');

-- ------------------------------ historial por fechas: gastos por fecha

-- Hoy: un gasto por fecha de la organización (4) y uno del grupo (7), y dos por
-- edición (10 y 30) que llevan la misma fecha.
INSERT INTO polla_groups (polla_group_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000170e001', 'a9000000-0000-0000-0000-000000000170', 'Grupo corte');
INSERT INTO polla_org_expenses (polla_organization_id, polla_group_id, date, name, amount, polla_edition_id) VALUES
  ('a9000000-0000-0000-0000-000000000170', NULL, polla_today(), 'Por fecha', 4, NULL),
  ('a9000000-0000-0000-0000-000000000170', 'a9000000-0000-0000-0000-00000170e001', polla_today(), 'Por fecha grupo', 7, NULL),
  ('a9000000-0000-0000-0000-000000000170', NULL, polla_today(), 'Por edición', 10, pg_temp.ed('E2')),
  ('a9000000-0000-0000-0000-000000000170', 'a9000000-0000-0000-0000-00000170e001', polla_today(), 'Por edición grupo', 30, pg_temp.ed('E2'));
SELECT is(
  (SELECT total_expenses FROM polla_current_account_daily_totals('a9000000-0000-0000-0000-000000000170', polla_today(), polla_today())),
  11::NUMERIC, 'los totales por día suman solo los gastos por fecha (4 + 7)');
SELECT is(
  (polla_group_account_preview('a9000000-0000-0000-0000-000000000170', 'a9000000-0000-0000-0000-00000170e001', polla_today()))->>'expenses',
  '7.00', 'y la cuenta del grupo por fecha también');

SELECT * FROM finish();
ROLLBACK;
