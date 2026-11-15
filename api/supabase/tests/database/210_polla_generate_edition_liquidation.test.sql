-- "Generar liquidación" por edición (20261115195936): carga los movimientos
-- nuevos de cada elegido, los liquida y marca la edición, todo junto. Con
-- jugadas cambiadas y sin origen elegido avisa las diferencias sin escribir
-- nada; si la edición ya estaba marcada, conserva la primera marca.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(22);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-000000000210', 'pgTAP generar liquidación');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000210e001', 'a9000000-0000-0000-0000-000000000210', 'Grupo 210');

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
SELECT ('a9000000-0000-0000-0000-00000210c00' || n)::UUID, 'CASHIER', 'Pasador ' || n, n,
       'a9000000-0000-0000-0000-000000000210', 'a9000000-0000-0000-0000-00000210e001', 10, 0
FROM generate_series(1, 3) n;
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a9000000-0000-0000-0000-00000210d001', 'OWNER', 'Dueño 210', 'a9000000-0000-0000-0000-000000000210');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000210a001', 'a9000000-0000-0000-0000-000000000210', 'Nacional 210');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a9000000-0000-0000-0000-00000210b001', 'a9000000-0000-0000-0000-000000000210', 'Nocturna 210', '21:00');

CREATE TEMP TABLE eds (name TEXT PRIMARY KEY, id UUID NOT NULL);

-- p_past: la carga ya cerró (si no, queda abierta).
CREATE FUNCTION pg_temp.edition(p_name TEXT, p_past BOOLEAN) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := (polla_create_edition(
    'a9000000-0000-0000-0000-000000000210',
    jsonb_build_object(
      'name', p_name, 'start_date', polla_today() + 1, 'end_date', polla_today() + 5,
      'load_limit_date', polla_today() + 1, 'load_limit_time', '20:00',
      'pool_amount', 1000, 'ticket_price', 100
    ),
    jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', 'a9000000-0000-0000-0000-00000210a001',
      'polla_schedule_id', 'a9000000-0000-0000-0000-00000210b001'))
  )->>'polla_edition_id')::UUID;
  IF p_past THEN
    UPDATE polla_editions
    SET load_start_date = polla_today() - 20, load_limit_date = polla_today() - 12,
        start_date = polla_today() - 10, end_date = polla_today() + 5
    WHERE polla_edition_id = v_id;
  END IF;
  INSERT INTO eds VALUES (p_name, v_id);
END;
$$;

CREATE FUNCTION pg_temp.ed(p_name TEXT) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM eds WHERE name = p_name;
$$;

CREATE FUNCTION pg_temp.cashier(p_n INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT ('a9000000-0000-0000-0000-00000210c00' || p_n)::UUID;
$$;

CREATE FUNCTION pg_temp.bet(p_edition TEXT, p_cashier INTEGER, p_ticket TEXT) RETURNS VOID
LANGUAGE sql AS $$
  INSERT INTO polla_bets (
    ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id, polla_organization_id,
    user_name, cashier_name, cashier_number, load_date, amount, numbers
  ) VALUES (
    p_ticket, pg_temp.ed(p_edition), pg_temp.cashier(p_cashier), pg_temp.cashier(p_cashier),
    'a9000000-0000-0000-0000-000000000210', 'Pasador ' || p_cashier, 'Pasador ' || p_cashier, p_cashier,
    polla_today() - 11, 100, ARRAY['01','02','03','04','05','06','07','08','09','10']
  );
$$;

CREATE FUNCTION pg_temp.generate(p_edition TEXT, p_entries JSONB, p_source TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE sql AS $$
  SELECT polla_generate_edition_liquidation(
    'a9000000-0000-0000-0000-000000000210', pg_temp.ed(p_edition),
    'a9000000-0000-0000-0000-00000210d001', p_entries, p_source);
$$;

CREATE FUNCTION pg_temp.entry(p_cashier INTEGER, p_collection NUMERIC DEFAULT 0, p_payment NUMERIC DEFAULT 0,
                              p_claim NUMERIC DEFAULT 0) RETURNS JSONB
LANGUAGE sql AS $$
  SELECT jsonb_build_object('polla_user_id', pg_temp.cashier(p_cashier),
    'collection', p_collection, 'payment', p_payment, 'claim', p_claim);
$$;

-- Movimientos vigentes de un pasador en una edición, de un tipo.
CREATE FUNCTION pg_temp.movs(p_edition TEXT, p_cashier INTEGER, p_type polla_account_movement_type_enum)
RETURNS NUMERIC LANGUAGE sql AS $$
  SELECT COALESCE(sum(amount), 0) FROM polla_edition_account_movements
  WHERE polla_edition_id = pg_temp.ed(p_edition) AND polla_user_id = pg_temp.cashier(p_cashier)
    AND type = p_type AND deleted_at IS NULL;
$$;

-- La última liquidación de un pasador en una edición.
CREATE FUNCTION pg_temp.liq(p_edition TEXT, p_cashier INTEGER) RETURNS polla_edition_liquidations
LANGUAGE sql AS $$
  SELECT * FROM polla_edition_liquidations
  WHERE polla_edition_id = pg_temp.ed(p_edition) AND polla_user_id = pg_temp.cashier(p_cashier)
  ORDER BY created_at DESC LIMIT 1;
$$;

SELECT pg_temp.edition('cerrada', TRUE);
SELECT pg_temp.edition('abierta', FALSE);
SELECT pg_temp.bet('cerrada', 1, 'T-1');
SELECT pg_temp.bet('cerrada', 1, 'T-2');
SELECT pg_temp.bet('cerrada', 2, 'T-3');

-- ------------------------------------------------------------ generar

CREATE TEMP TABLE r1 AS
SELECT pg_temp.generate('cerrada', jsonb_build_array(
  pg_temp.entry(1, p_collection => 150, p_claim => 10),
  pg_temp.entry(2),
  pg_temp.entry(3))) AS j;

SELECT is((SELECT j->>'status' FROM r1), 'LIQUIDATED', 'genera la liquidación');
SELECT is((SELECT jsonb_array_length(j->'liquidations') FROM r1), 3,
  'una por pasador elegido, también el que está en cero');
SELECT is(pg_temp.movs('cerrada', 1, 'COLLECTION'), 150::NUMERIC, 'carga el cobro nuevo');
SELECT is(pg_temp.movs('cerrada', 1, 'CLAIM'), 10::NUMERIC, 'y el reclamo');
SELECT is(
  (SELECT count(*) FROM polla_edition_account_movements
   WHERE polla_edition_id = pg_temp.ed('cerrada') AND type = 'PAYMENT'),
  0::BIGINT, 'un monto en 0 no carga nada');
SELECT is(
  (SELECT count(*) FROM polla_edition_account_movements
   WHERE polla_edition_id = pg_temp.ed('cerrada') AND date = polla_today()
     AND created_by = 'a9000000-0000-0000-0000-00000210d001'),
  2::BIGINT, 'los movimientos quedan con fecha de hoy y a nombre de quien genera');
-- 200 de pase + 10 de reclamo = 210; comisión 21; subtotal 189; − cobro 150 = 39.
SELECT is((pg_temp.liq('cerrada', 1)).total, 39::NUMERIC(12,2),
  'la foto del pasador incluye los movimientos recién cargados');
SELECT is((pg_temp.liq('cerrada', 3)).total, 0::NUMERIC(12,2), 'el que está en cero queda en cero');
SELECT ok(
  (SELECT liquidated_at IS NOT NULL AND liquidated_by = 'a9000000-0000-0000-0000-00000210d001'
   FROM polla_editions WHERE polla_edition_id = pg_temp.ed('cerrada')),
  'la edición queda marcada como liquidada');

-- ----------------------------------------------- volver a generar

UPDATE polla_editions SET liquidated_at = '2026-01-01 10:00:00+00'
WHERE polla_edition_id = pg_temp.ed('cerrada');

SELECT is(pg_temp.generate('cerrada', jsonb_build_array(pg_temp.entry(1, p_payment => 5)))->>'status',
  'LIQUIDATED', 'se vuelve a generar');
SELECT is((pg_temp.liq('cerrada', 1)).total, 44::NUMERIC(12,2), 'con el pago nuevo (39 + 5)');
SELECT is(
  (SELECT liquidated_at FROM polla_editions WHERE polla_edition_id = pg_temp.ed('cerrada')),
  '2026-01-01 10:00:00+00'::TIMESTAMPTZ, 'y conserva la primera marca');

-- ---------------------------------------- jugadas cambiadas: diferencias

SELECT pg_temp.bet('cerrada', 1, 'T-4');

SELECT is(pg_temp.generate('cerrada', jsonb_build_array(pg_temp.entry(1, p_collection => 20)))->>'status',
  'DIFFERENCES', 'sin origen elegido avisa las diferencias');
SELECT is(pg_temp.movs('cerrada', 1, 'COLLECTION'), 150::NUMERIC, 'y no carga el cobro');
SELECT is(pg_temp.generate('cerrada', jsonb_build_array(pg_temp.entry(1, p_collection => 20)), 'NEW')->>'status',
  'LIQUIDATED', 'eligiendo la nueva, liquida');
SELECT is(pg_temp.movs('cerrada', 1, 'COLLECTION'), 170::NUMERIC, 'con el cobro');
-- 300 + 10 = 310; comisión 31; subtotal 279; − 170 + 5 = 114.
SELECT is((pg_temp.liq('cerrada', 1)).total, 114::NUMERIC(12,2), 'y las jugadas de hoy');

-- ------------------------------------------------------------ errores

SELECT throws_ok($$SELECT pg_temp.generate('cerrada', '[]'::JSONB)$$,
  'P0001', 'POLLA_EDITION_LIQUIDATION_EMPTY', 'sin pasadores no genera');
SELECT throws_ok($$SELECT pg_temp.generate('cerrada', jsonb_build_array(pg_temp.entry(2), pg_temp.entry(2)))$$,
  'P0001', 'POLLA_EDITION_LIQUIDATION_DUPLICATE', 'un pasador repetido');
SELECT throws_ok($$SELECT pg_temp.generate('cerrada', jsonb_build_array(pg_temp.entry(2, p_collection => -5)))$$,
  'P0001', 'POLLA_EDITION_LIQUIDATION_AMOUNT_INVALID', 'un cobro negativo');
SELECT throws_ok(
  $$SELECT pg_temp.generate('cerrada', jsonb_build_array(jsonb_build_object(
      'polla_user_id', 'a9000000-0000-0000-0000-00000210d001')))$$,
  'P0001', 'POLLA_ACCOUNT_USER_NOT_CASHIER', 'alguien que no es pasador');
SELECT throws_ok($$SELECT pg_temp.generate('abierta', jsonb_build_array(pg_temp.entry(2, p_collection => 50)))$$,
  'P0001', 'POLLA_EDITION_LOAD_OPEN', 'con la carga abierta no genera (y no deja el cobro cargado)');

SELECT * FROM finish();
ROLLBACK;
