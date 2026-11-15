-- R18 después de la cuenta por edición: la cuenta por días quedó solo para
-- consultar. Lo guardado no cambia (tampoco el premio de un día liquidado
-- antes de R18) y las funciones que la escribían responden
-- POLLA_DAILY_ACCOUNT_READ_ONLY. Que los premios no entran en la cuenta por
-- edición lo prueba 175.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(10);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a1000000-0000-0000-0000-000000000018', 'pgTAP R18');

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, fee, fee_plus) VALUES
  ('a1000000-0000-0000-0000-0000000018c1', 'CASHIER', 'Abierto', 1, 'a1000000-0000-0000-0000-000000000018', 10, 0),
  ('a1000000-0000-0000-0000-0000000018c2', 'CASHIER', 'Liquidado', 2, 'a1000000-0000-0000-0000-000000000018', 10, 0);

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a1000000-0000-0000-0000-0000000018a1', 'a1000000-0000-0000-0000-000000000018', 'Nacional R18');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a1000000-0000-0000-0000-0000000018b1', 'a1000000-0000-0000-0000-000000000018', 'Nocturna R18', '21:00');

INSERT INTO polla_editions (
  polla_edition_id, polla_organization_id, polla_lottery_id, polla_schedule_id,
  start_date, end_date, load_limit_date, load_limit_time, pool_amount, ticket_price
) VALUES (
  'a1000000-0000-0000-0000-0000000018e1', 'a1000000-0000-0000-0000-000000000018',
  'a1000000-0000-0000-0000-0000000018a1', 'a1000000-0000-0000-0000-0000000018b1',
  '2030-01-01', '2030-01-31', '2029-12-31', '20:00', 5000, 100
);

CREATE FUNCTION pg_temp.bet(p_ticket TEXT, p_cashier UUID, p_load DATE, p_prize NUMERIC, p_hit DATE)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO polla_bets (
    ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id, polla_organization_id,
    user_name, cashier_name, cashier_number, load_date, amount, numbers, winner, prize, hit_date
  ) VALUES (
    p_ticket, 'a1000000-0000-0000-0000-0000000018e1', p_cashier, p_cashier,
    'a1000000-0000-0000-0000-000000000018', 'Pasador', 'Pasador', 1, p_load, 100,
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    p_prize > 0, p_prize, p_hit
  );
$$;

CREATE FUNCTION pg_temp.row_of(p_cashier UUID, p_date DATE) RETURNS polla_current_accounts LANGUAGE sql AS $$
  SELECT * FROM polla_current_accounts WHERE polla_user_id = p_cashier AND date = p_date;
$$;

-- Cantidad y md5 de las dos tablas por días.
CREATE FUNCTION pg_temp.daily_snapshot() RETURNS TEXT LANGUAGE sql AS $$
  SELECT
    (SELECT count(*) || ':' || COALESCE(md5(string_agg(ca::TEXT, '|' ORDER BY ca.polla_current_account_id)), '')
     FROM polla_current_accounts ca)
    || ' / ' ||
    (SELECT count(*) || ':' || COALESCE(md5(string_agg(ga::TEXT, '|' ORDER BY ga.polla_group_account_id)), '')
     FROM polla_group_accounts ga);
$$;

-- Lo guardado por días antes del corte. El pasador 1 cargó dos tickets el 10 y
-- uno ganó $5.000 el 12 (sin liquidar, el premio afuera). El pasador 2 ganó
-- $5.000 el 5 y se liquidó el 6, antes de R18: la fila del 5 lleva el premio.
SELECT pg_temp.bet('R18-1', 'a1000000-0000-0000-0000-0000000018c1', '2030-01-10', 0, NULL);
SELECT pg_temp.bet('R18-2', 'a1000000-0000-0000-0000-0000000018c1', '2030-01-10', 5000, '2030-01-12');
SELECT pg_temp.bet('R18-3', 'a1000000-0000-0000-0000-0000000018c2', '2030-01-04', 5000, '2030-01-05');
INSERT INTO polla_current_accounts (
  polla_user_id, user_name, user_number, polla_organization_id, date, is_liquidated,
  bets_pass, pass, cashier_commission, successes, subtotal, revenue, total
) VALUES
  ('a1000000-0000-0000-0000-0000000018c1', 'Abierto', 1, 'a1000000-0000-0000-0000-000000000018',
   '2030-01-10', FALSE, 200, 200, 20, 0, 180, 180, 180),
  ('a1000000-0000-0000-0000-0000000018c1', 'Abierto', 1, 'a1000000-0000-0000-0000-000000000018',
   '2030-01-12', FALSE, 0, 0, 0, 0, 0, 0, 180),
  ('a1000000-0000-0000-0000-0000000018c2', 'Liquidado', 2, 'a1000000-0000-0000-0000-000000000018',
   '2030-01-05', TRUE, 0, 0, 0, 5000, -5000, -5000, -5000),
  ('a1000000-0000-0000-0000-0000000018c2', 'Liquidado', 2, 'a1000000-0000-0000-0000-000000000018',
   '2030-01-06', TRUE, 0, 0, 0, 0, 0, 0, -5000);

CREATE TEMP TABLE daily_before AS SELECT pg_temp.daily_snapshot() AS h;

-- ------------------------------------------- las escrituras por días

SELECT throws_ok(
  $$SELECT polla_calculate_current_account('12-01-2030', FALSE, FALSE, 'a1000000-0000-0000-0000-000000000018')$$,
  'P0001', 'POLLA_DAILY_ACCOUNT_READ_ONLY', 'no se calcula un día');
SELECT throws_ok(
  $$SELECT polla_calculate_current_account('05-01-2030', FALSE, TRUE, 'a1000000-0000-0000-0000-000000000018')$$,
  'P0001', 'POLLA_DAILY_ACCOUNT_READ_ONLY', 'ni se liquida por días');
SELECT throws_ok(
  $$SELECT polla_cascade_current_account_from_date('10-01-2030', 'a1000000-0000-0000-0000-000000000018')$$,
  'P0001', 'POLLA_DAILY_ACCOUNT_READ_ONLY', 'ni se encadenan los saldos');
SELECT throws_ok(
  $$SELECT polla_update_current_account_recompute(
      (pg_temp.row_of('a1000000-0000-0000-0000-0000000018c1', '2030-01-12')).polla_current_account_id,
      '{"collections": 50}', FALSE, 'a1000000-0000-0000-0000-000000000018')$$,
  'P0001', 'POLLA_DAILY_ACCOUNT_READ_ONLY', 'ni se edita una fila');
SELECT throws_ok(
  $$SELECT polla_recalculate_open_period('a1000000-0000-0000-0000-000000000018', '2030-01-12')$$,
  'P0001', 'POLLA_DAILY_ACCOUNT_READ_ONLY', 'ni se recalcula el período abierto');
SELECT throws_ok(
  $$SELECT polla_liquidate_group('a1000000-0000-0000-0000-000000000018', gen_random_uuid(), '2030-01-12', 10, 0, 0, NULL)$$,
  'P0001', 'POLLA_DAILY_ACCOUNT_READ_ONLY', 'ni se liquida un grupo por fecha');
SELECT lives_ok(
  $$SELECT polla_refresh_current_account_row('a1000000-0000-0000-0000-0000000018c1', '2030-01-12',
      'a1000000-0000-0000-0000-000000000018')$$,
  'actualizar la fila de un día (al cargar o borrar tickets) no falla y no hace nada');

-- ------------------------------------------------- lo guardado no cambia

SELECT is(pg_temp.daily_snapshot(), (SELECT h FROM daily_before), 'la cuenta por días quedó igual');
SELECT is((pg_temp.row_of('a1000000-0000-0000-0000-0000000018c2', '2030-01-05')).successes,
          5000.00::NUMERIC(12,2), 'un día liquidado antes de R18 conserva su premio');
SELECT is((pg_temp.row_of('a1000000-0000-0000-0000-0000000018c1', '2030-01-12')).total,
          180.00::NUMERIC(12,2), 'y un día sin liquidar no suma el premio');

SELECT * FROM finish();
ROLLBACK;
