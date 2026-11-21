-- % de ganancia del admin de grupo (polla_users.admin_percentage) y liquidar
-- varios grupos juntos (polla_liquidate_group_editions).
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(16);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-000000000250', 'pgTAP % del admin');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number)
VALUES ('a9000000-0000-0000-0000-00000250e001', 'a9000000-0000-0000-0000-000000000250', 'G1 250', 1),
       ('a9000000-0000-0000-0000-00000250e002', 'a9000000-0000-0000-0000-000000000250', 'G2 250', 2),
       ('a9000000-0000-0000-0000-00000250e003', 'a9000000-0000-0000-0000-000000000250', 'G3 250', 3);

-- Un pasador por grupo (fee 10) y los admins de G1 y G2; G3 no tiene admin.
INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
SELECT ('a9000000-0000-0000-0000-00000250c00' || n)::UUID, 'CASHIER', 'Pasador ' || n, n,
       'a9000000-0000-0000-0000-000000000250', ('a9000000-0000-0000-0000-00000250e00' || n)::UUID, 10, 0
FROM generate_series(1, 3) n;
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id, polla_group_id)
VALUES ('a9000000-0000-0000-0000-00000250a001', 'ADMIN', 'Admin 1', 'a9000000-0000-0000-0000-000000000250', 'a9000000-0000-0000-0000-00000250e001'),
       ('a9000000-0000-0000-0000-00000250a002', 'ADMIN', 'Admin 2', 'a9000000-0000-0000-0000-000000000250', 'a9000000-0000-0000-0000-00000250e002');
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a9000000-0000-0000-0000-00000250d001', 'OWNER', 'Dueño 250', 'a9000000-0000-0000-0000-000000000250');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000250f001', 'a9000000-0000-0000-0000-000000000250', 'Nacional 250');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a9000000-0000-0000-0000-00000250b001', 'a9000000-0000-0000-0000-000000000250', 'Nocturna 250', '21:00');

CREATE FUNCTION pg_temp.org() RETURNS UUID LANGUAGE sql AS $$
  SELECT 'a9000000-0000-0000-0000-000000000250'::UUID;
$$;
CREATE FUNCTION pg_temp.owner() RETURNS UUID LANGUAGE sql AS $$
  SELECT 'a9000000-0000-0000-0000-00000250d001'::UUID;
$$;
CREATE FUNCTION pg_temp.g(p_n INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT ('a9000000-0000-0000-0000-00000250e00' || p_n)::UUID;
$$;
CREATE FUNCTION pg_temp.cashier(p_n INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT ('a9000000-0000-0000-0000-00000250c00' || p_n)::UUID;
$$;
CREATE FUNCTION pg_temp.admin(p_n INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT ('a9000000-0000-0000-0000-00000250a00' || p_n)::UUID;
$$;

-- Edición con la carga cerrada.
CREATE TEMP TABLE ed250 AS
SELECT (polla_create_edition(
  pg_temp.org(),
  jsonb_build_object(
    'name', 'A 250', 'start_date', polla_today() + 1, 'end_date', polla_today() + 5,
    'load_limit_date', polla_today() + 1, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ),
  jsonb_build_array(jsonb_build_object(
    'polla_lottery_id', 'a9000000-0000-0000-0000-00000250f001',
    'polla_schedule_id', 'a9000000-0000-0000-0000-00000250b001'))
)->>'polla_edition_id')::UUID AS id;
UPDATE polla_editions
SET load_start_date = polla_today() - 20, load_limit_date = polla_today() - 12,
    start_date = polla_today() - 10, end_date = polla_today() + 5
WHERE polla_edition_id = (SELECT id FROM ed250);

CREATE FUNCTION pg_temp.ed() RETURNS UUID LANGUAGE sql AS $$ SELECT id FROM ed250; $$;

-- Cada pasador deja un ticket de 100 (subtotal 90). P1 y P2 liquidados; P3 no.
INSERT INTO polla_bets (
  ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id, polla_organization_id,
  user_name, cashier_name, cashier_number, load_date, amount, numbers
)
SELECT 'T250-' || n, pg_temp.ed(), pg_temp.cashier(n), pg_temp.cashier(n), pg_temp.org(),
       'Pasador ' || n, 'Pasador ' || n, n, polla_today() - 3, 100,
       ARRAY['01','02','03','04','05','06','07','08','09','10']
FROM generate_series(1, 3) n;
SELECT polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed(),
  ARRAY[pg_temp.cashier(1), pg_temp.cashier(2)], pg_temp.owner());

-- ------------------------------------------------------------- la columna
SELECT throws_ok(
  $$UPDATE polla_users SET admin_percentage = 10 WHERE polla_user_id = pg_temp.cashier(1)$$,
  '23514', NULL, 'un pasador no tiene % de admin');
SELECT throws_ok(
  $$UPDATE polla_users SET admin_percentage = 150 WHERE polla_user_id = pg_temp.admin(1)$$,
  '23514', NULL, 'el % va de 0 a 100');
SELECT lives_ok(
  $$UPDATE polla_users SET admin_percentage = 12.5 WHERE polla_user_id = pg_temp.admin(1)$$,
  'el admin tiene su %');

-- ------------------------------------------------------- alta con el admin
-- La función se llama una sola vez (fuera del WHERE, que la evaluaría por fila).
CREATE TEMP TABLE created250 AS
SELECT 'con'::TEXT AS k, polla_create_group_with_admin(pg_temp.org(), 'Nuevo 250',
  jsonb_build_object('name', 'Adm nuevo', 'username', 'adm250nuevo', 'password_hash', 'x',
                     'admin_percentage', 15)) AS r
UNION ALL
SELECT 'sin', polla_create_group_with_admin(pg_temp.org(), 'Sin % 250',
  jsonb_build_object('name', 'Adm sin', 'username', 'adm250sin', 'password_hash', 'x'));

SELECT is(
  (SELECT u.admin_percentage FROM polla_users u JOIN created250 c
     ON u.polla_user_id = (c.r->>'admin_polla_user_id')::UUID WHERE c.k = 'con'),
  15.00::NUMERIC(5,2), 'el alta del grupo guarda el % del admin');
SELECT is(
  (SELECT u.admin_percentage FROM polla_users u JOIN created250 c
     ON u.polla_user_id = (c.r->>'admin_polla_user_id')::UUID WHERE c.k = 'sin'),
  NULL::NUMERIC(5,2), 'sin % queda en NULL (se carga a mano)');

-- ------------------------------------------------------- liquidar un grupo
SELECT is(
  (polla_liquidate_group_edition(pg_temp.org(), pg_temp.g(1), pg_temp.ed(), 50, 0, 0, 0, 0, pg_temp.owner())).admin_percentage,
  12.50::NUMERIC(5,2), 'con % en el admin se usa ese, no el del cliente');
SELECT is(
  (SELECT admin_commission FROM polla_group_edition_accounts
   WHERE polla_group_id = pg_temp.g(1) AND polla_edition_id = pg_temp.ed()),
  11.25::NUMERIC(12,2), 'comisión = 90 × 12,5%');
SELECT throws_like(
  $$SELECT polla_liquidate_group_edition(pg_temp.org(), pg_temp.g(2), pg_temp.ed(), NULL, 0, 0, 0, 0, pg_temp.owner())$$,
  '%POLLA_GROUP_PERCENTAGE_INVALID%', 'admin sin %: hay que mandar uno');
SELECT is(
  (polla_liquidate_group_edition(pg_temp.org(), pg_temp.g(2), pg_temp.ed(), 20, 0, 0, 0, 0, pg_temp.owner())).admin_percentage,
  20.00::NUMERIC(5,2), 'admin sin %: se usa el del cliente');

-- ------------------------------------------------------------ varios grupos
SELECT is(
  (SELECT count(*)::INTEGER FROM polla_liquidate_group_editions(pg_temp.org(), pg_temp.ed(),
     jsonb_build_array(
       jsonb_build_object('polla_group_id', pg_temp.g(2), 'admin_percentage', 30),
       jsonb_build_object('polla_group_id', pg_temp.g(1))),
     pg_temp.owner())),
  2, 'liquida los dos grupos');
SELECT is(
  (SELECT admin_percentage FROM polla_group_edition_accounts
   WHERE polla_group_id = pg_temp.g(2) AND polla_edition_id = pg_temp.ed()),
  30.00::NUMERIC(5,2), 'cada grupo con su %');

-- G3 tiene a P3 sin liquidar: falla todo el lote y G1 queda como estaba.
UPDATE polla_users SET admin_percentage = 40 WHERE polla_user_id = pg_temp.admin(1);
SELECT throws_like(
  $$SELECT * FROM polla_liquidate_group_editions(pg_temp.org(), pg_temp.ed(),
     jsonb_build_array(
       jsonb_build_object('polla_group_id', pg_temp.g(1)),
       jsonb_build_object('polla_group_id', pg_temp.g(3), 'admin_percentage', 10)),
     pg_temp.owner())$$,
  '%POLLA_GROUP_BATCH[Grupo 3 - G3 250]%POLLA_GROUP_CASHIERS_PENDING%',
  'el error dice qué grupo falló');
SELECT is(
  (SELECT admin_percentage FROM polla_group_edition_accounts
   WHERE polla_group_id = pg_temp.g(1) AND polla_edition_id = pg_temp.ed()),
  12.50::NUMERIC(5,2), 'si uno falla no se liquida ninguno');

SELECT throws_like(
  $$SELECT * FROM polla_liquidate_group_editions(pg_temp.org(), pg_temp.ed(), '[]'::JSONB, pg_temp.owner())$$,
  '%POLLA_GROUP_BATCH_EMPTY%', 'sin grupos no hace nada');
SELECT throws_like(
  $$SELECT * FROM polla_liquidate_group_editions(pg_temp.org(), pg_temp.ed(),
     jsonb_build_array(
       jsonb_build_object('polla_group_id', pg_temp.g(1)),
       jsonb_build_object('polla_group_id', pg_temp.g(1))),
     pg_temp.owner())$$,
  '%POLLA_GROUP_BATCH_DUPLICATED%', 'un grupo repetido');
SELECT throws_like(
  $$SELECT * FROM polla_liquidate_group_editions(pg_temp.org(), pg_temp.ed(),
     jsonb_build_array(jsonb_build_object('polla_group_id', gen_random_uuid())),
     pg_temp.owner())$$,
  '%POLLA_GROUP_NOT_FOUND%', 'un grupo de otra organización o inexistente');

SELECT * FROM finish();
ROLLBACK;
