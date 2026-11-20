-- Cobros y pagos de grupo: tabla polla_group_edition_movements, sumas en
-- polla_group_edition_accounts (collections / payments) y su carga al liquidar.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(21);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-000000000270', 'pgTAP movimientos de grupo');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number)
VALUES ('a9000000-0000-0000-0000-00000270e001', 'a9000000-0000-0000-0000-000000000270', 'G1 270', 1),
       ('a9000000-0000-0000-0000-00000270e002', 'a9000000-0000-0000-0000-000000000270', 'G2 270', 2);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
SELECT ('a9000000-0000-0000-0000-00000270c00' || n)::UUID, 'CASHIER', 'Pasador ' || n, n,
       'a9000000-0000-0000-0000-000000000270', ('a9000000-0000-0000-0000-00000270e00' || n)::UUID, 10, 0
FROM generate_series(1, 2) n;
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a9000000-0000-0000-0000-00000270d001', 'OWNER', 'Dueño 270', 'a9000000-0000-0000-0000-000000000270');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000270f001', 'a9000000-0000-0000-0000-000000000270', 'Nacional 270');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a9000000-0000-0000-0000-00000270b001', 'a9000000-0000-0000-0000-000000000270', 'Nocturna 270', '21:00');

CREATE FUNCTION pg_temp.org() RETURNS UUID LANGUAGE sql AS $$
  SELECT 'a9000000-0000-0000-0000-000000000270'::UUID;
$$;
CREATE FUNCTION pg_temp.owner() RETURNS UUID LANGUAGE sql AS $$
  SELECT 'a9000000-0000-0000-0000-00000270d001'::UUID;
$$;
CREATE FUNCTION pg_temp.g(p_n INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT ('a9000000-0000-0000-0000-00000270e00' || p_n)::UUID;
$$;
CREATE FUNCTION pg_temp.cashier(p_n INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT ('a9000000-0000-0000-0000-00000270c00' || p_n)::UUID;
$$;

CREATE TEMP TABLE ed270 AS
SELECT (polla_create_edition(
  pg_temp.org(),
  jsonb_build_object(
    'name', 'A 270', 'start_date', polla_today() + 1, 'end_date', polla_today() + 5,
    'load_limit_date', polla_today() + 1, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ),
  jsonb_build_array(jsonb_build_object(
    'polla_lottery_id', 'a9000000-0000-0000-0000-00000270f001',
    'polla_schedule_id', 'a9000000-0000-0000-0000-00000270b001'))
)->>'polla_edition_id')::UUID AS id;
UPDATE polla_editions
SET load_start_date = polla_today() - 20, load_limit_date = polla_today() - 12,
    start_date = polla_today() - 10, end_date = polla_today() + 5
WHERE polla_edition_id = (SELECT id FROM ed270);

CREATE FUNCTION pg_temp.ed() RETURNS UUID LANGUAGE sql AS $$ SELECT id FROM ed270; $$;

-- Un ticket de 100 por pasador. Solo P1 se liquida: G2 queda con un pendiente.
INSERT INTO polla_bets (
  ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id, polla_organization_id,
  user_name, cashier_name, cashier_number, load_date, amount, numbers
)
SELECT 'T270-' || n, pg_temp.ed(), pg_temp.cashier(n), pg_temp.cashier(n), pg_temp.org(),
       'Pasador ' || n, 'Pasador ' || n, n, polla_today() - 3, 100,
       ARRAY['01','02','03','04','05','06','07','08','09','10']
FROM generate_series(1, 2) n;
SELECT polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed(),
  ARRAY[pg_temp.cashier(1)], pg_temp.owner());

CREATE FUNCTION pg_temp.liq1(p_collection NUMERIC, p_payment NUMERIC) RETURNS polla_group_edition_accounts
LANGUAGE sql AS $$
  SELECT polla_liquidate_group_edition(pg_temp.org(), pg_temp.g(1), pg_temp.ed(), 10, 0, 0,
    p_collection, p_payment, pg_temp.owner());
$$;
CREATE FUNCTION pg_temp.acc(p_col TEXT) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE v NUMERIC;
BEGIN
  EXECUTE format('SELECT %I FROM polla_group_edition_accounts WHERE polla_group_id = $1 AND polla_edition_id = $2', p_col)
    INTO v USING pg_temp.g(1), pg_temp.ed();
  RETURN v;
END;
$$;
CREATE FUNCTION pg_temp.movs() RETURNS INTEGER LANGUAGE sql AS $$
  SELECT count(*)::INTEGER FROM polla_group_edition_movements
  WHERE polla_group_id = pg_temp.g(1) AND polla_edition_id = pg_temp.ed() AND deleted_at IS NULL;
$$;

-- --------------------------------------------------------------- liquidar
SELECT is((pg_temp.liq1(300, 0)).collections, 300.00::NUMERIC(12,2),
  'liquidar con cobro 300: la fila devuelta ya trae la suma');
SELECT is(pg_temp.movs(), 1, 'queda 1 movimiento (el pago 0 no inserta)');
SELECT is(
  (SELECT type::TEXT FROM polla_group_edition_movements WHERE polla_group_id = pg_temp.g(1)),
  'COLLECTION', 'es un cobro');

SELECT is((pg_temp.liq1(200, NULL)).collections, 500.00::NUMERIC(12,2), 'reliquidar suma otro cobro');
SELECT is(pg_temp.movs(), 2, 'quedan 2 movimientos (un monto nulo es 0)');

SELECT is((pg_temp.liq1(0, 40)).payments, 40.00::NUMERIC(12,2), 'un pago suma en payments');
SELECT is(pg_temp.movs(), 3, 'cobro 0 no inserta: 3 movimientos');

-- --------------------------------------------- editar y borrar un movimiento
-- NOW() es fijo dentro de la transacción: se fuerza una fecha vieja para ver que no cambia.
UPDATE polla_group_edition_accounts SET edited_at = '2026-01-01T00:00:00Z'
WHERE polla_group_id = pg_temp.g(1) AND polla_edition_id = pg_temp.ed();

UPDATE polla_group_edition_movements SET amount = 250
WHERE polla_group_id = pg_temp.g(1) AND type = 'COLLECTION' AND amount = 300;
SELECT is(pg_temp.acc('collections'), 450.00::NUMERIC, 'editar el monto recalcula la suma (250 + 200)');

UPDATE polla_group_edition_movements SET deleted_at = NOW()
WHERE polla_group_id = pg_temp.g(1) AND type = 'COLLECTION' AND amount = 250;
SELECT is(pg_temp.acc('collections'), 200.00::NUMERIC, 'borrar uno recalcula la suma');
SELECT is(
  (SELECT edited_at FROM polla_group_edition_accounts
   WHERE polla_group_id = pg_temp.g(1) AND polla_edition_id = pg_temp.ed()),
  '2026-01-01T00:00:00Z'::TIMESTAMPTZ, 'editar o borrar no toca edited_at');

-- --------------------------------------------------------------- inválidos
SELECT throws_like(
  $$SELECT pg_temp.liq1(-5, 0)$$, '%POLLA_GROUP_MOVEMENT_INVALID%', 'un cobro negativo se rechaza');
SELECT throws_like(
  $$SELECT pg_temp.liq1(0, -1)$$, '%POLLA_GROUP_MOVEMENT_INVALID%', 'un pago negativo se rechaza');

-- G2 tiene a P2 sin liquidar: falla el lote y G1 no deja movimientos.
SELECT throws_like(
  $$SELECT * FROM polla_liquidate_group_editions(pg_temp.org(), pg_temp.ed(),
     jsonb_build_array(
       jsonb_build_object('polla_group_id', pg_temp.g(1), 'admin_percentage', 10, 'collection', 70),
       jsonb_build_object('polla_group_id', pg_temp.g(2), 'admin_percentage', 10, 'payment', 5)),
     pg_temp.owner())$$,
  '%POLLA_GROUP_BATCH[Grupo 2 - G2 270]%', 'el lote con un grupo que falla da error');
-- Este assert corre DESPUÉS de un throws_like, que llama en una subtransacción:
-- cualquier versión que termine tirando el error deja la cuenta igual, así que
-- por sí solo no distingue un lote atómico. Sirve de guarda del estado previo al
-- lote exitoso de abajo (G1 sigue con 2 movimientos); la atomicidad sale de que
-- el RPC corre en una sola transacción y la cubre el E2E contra la API.
SELECT is(pg_temp.movs(), 2, 'si el lote falla no queda ningún movimiento (G1 sigue con 2)');

-- ---------------------------------------------------------- lote exitoso
-- Se liquida el pasador 2 y el lote con cobro y pago en dos grupos anda: guarda
-- las claves JSONB (`collection` / `payment`) que lee el RPC.
SELECT polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed(),
  ARRAY[pg_temp.cashier(2)], pg_temp.owner());

CREATE FUNCTION pg_temp.acc2(p_group INTEGER, p_col TEXT) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE v NUMERIC;
BEGIN
  EXECUTE format('SELECT %I FROM polla_group_edition_accounts WHERE polla_group_id = $1 AND polla_edition_id = $2', p_col)
    INTO v USING pg_temp.g(p_group), pg_temp.ed();
  RETURN v;
END;
$$;

SELECT is(
  (SELECT count(*)::INTEGER FROM polla_liquidate_group_editions(pg_temp.org(), pg_temp.ed(),
     jsonb_build_array(
       jsonb_build_object('polla_group_id', pg_temp.g(1), 'admin_percentage', 10, 'collection', 70),
       jsonb_build_object('polla_group_id', pg_temp.g(2), 'admin_percentage', 10, 'collection', 30, 'payment', 5)),
     pg_temp.owner())),
  2, 'el lote con cobro y pago en dos grupos devuelve las dos cuentas');
SELECT is(pg_temp.acc2(1, 'collections'), 270.00::NUMERIC, 'G1: el cobro del lote se suma (200 + 70)');
SELECT is(pg_temp.acc2(1, 'payments'), 40.00::NUMERIC, 'G1: sin pago en el lote, payments no cambia');
SELECT is(pg_temp.acc2(2, 'collections'), 30.00::NUMERIC, 'G2: cobro del lote');
SELECT is(pg_temp.acc2(2, 'payments'), 5.00::NUMERIC, 'G2: pago del lote');
SELECT is(pg_temp.movs(), 3, 'G1 queda con 3 movimientos (el del lote)');
SELECT is(
  (SELECT count(*)::INTEGER FROM polla_group_edition_movements
   WHERE polla_group_id = pg_temp.g(2) AND polla_edition_id = pg_temp.ed() AND deleted_at IS NULL),
  2, 'G2 queda con 2 movimientos: un cobro y un pago');

SELECT * FROM finish();
ROLLBACK;
