-- Cuenta del grupo por edición: vista previa (subtotal de los pasadores según
-- su liquidación vigente, gastos de la edición, pendientes) y liquidación.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(23);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-000000000180', 'pgTAP cuenta grupo edición');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000180e001', 'a9000000-0000-0000-0000-000000000180', 'Grupo 1'),
       ('a9000000-0000-0000-0000-00000180e002', 'a9000000-0000-0000-0000-000000000180', 'Grupo 2');

-- P1, P2 y P3 en G1, con fee 10.
INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
SELECT ('a9000000-0000-0000-0000-00000180c00' || n)::UUID, 'CASHIER', 'Pasador ' || n, n,
       'a9000000-0000-0000-0000-000000000180', 'a9000000-0000-0000-0000-00000180e001', 10, 0
FROM generate_series(1, 3) n;
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a9000000-0000-0000-0000-00000180d001', 'OWNER', 'Dueño 180', 'a9000000-0000-0000-0000-000000000180');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000180a001', 'a9000000-0000-0000-0000-000000000180', 'Nacional 180');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a9000000-0000-0000-0000-00000180b001', 'a9000000-0000-0000-0000-000000000180', 'Nocturna 180', '21:00');

CREATE TEMP TABLE eds (name TEXT PRIMARY KEY, id UUID NOT NULL);

CREATE FUNCTION pg_temp.edition(p_name TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := (polla_create_edition(
    'a9000000-0000-0000-0000-000000000180',
    jsonb_build_object(
      'name', p_name, 'start_date', polla_today() + 1, 'end_date', polla_today() + 5,
      'load_limit_date', polla_today() + 1, 'load_limit_time', '20:00',
      'pool_amount', 1000, 'ticket_price', 100
    ),
    jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', 'a9000000-0000-0000-0000-00000180a001',
      'polla_schedule_id', 'a9000000-0000-0000-0000-00000180b001'))
  )->>'polla_edition_id')::UUID;
  -- La edición ya empezó y su carga cerró.
  UPDATE polla_editions
  SET load_start_date = polla_today() - 20, load_limit_date = polla_today() - 12,
      start_date = polla_today() - 10, end_date = polla_today() + 5
  WHERE polla_edition_id = v_id;
  INSERT INTO eds VALUES (p_name, v_id);
END;
$$;

CREATE FUNCTION pg_temp.ed(p_name TEXT) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM eds WHERE name = p_name;
$$;
CREATE FUNCTION pg_temp.cashier(p_n INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT ('a9000000-0000-0000-0000-00000180c00' || p_n)::UUID;
$$;
CREATE FUNCTION pg_temp.org() RETURNS UUID LANGUAGE sql AS $$
  SELECT 'a9000000-0000-0000-0000-000000000180'::UUID;
$$;
CREATE FUNCTION pg_temp.owner() RETURNS UUID LANGUAGE sql AS $$
  SELECT 'a9000000-0000-0000-0000-00000180d001'::UUID;
$$;
CREATE FUNCTION pg_temp.g1() RETURNS UUID LANGUAGE sql AS $$
  SELECT 'a9000000-0000-0000-0000-00000180e001'::UUID;
$$;
CREATE FUNCTION pg_temp.g2() RETURNS UUID LANGUAGE sql AS $$
  SELECT 'a9000000-0000-0000-0000-00000180e002'::UUID;
$$;

CREATE FUNCTION pg_temp.bet(p_edition TEXT, p_cashier INTEGER, p_ticket TEXT) RETURNS VOID
LANGUAGE sql AS $$
  INSERT INTO polla_bets (
    ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id, polla_organization_id,
    user_name, cashier_name, cashier_number, load_date, amount, numbers
  ) VALUES (
    p_ticket, pg_temp.ed(p_edition), pg_temp.cashier(p_cashier), pg_temp.cashier(p_cashier),
    pg_temp.org(), 'Pasador ' || p_cashier, 'Pasador ' || p_cashier, p_cashier,
    polla_today() - 3, 100, ARRAY['01','02','03','04','05','06','07','08','09','10']
  );
$$;

CREATE FUNCTION pg_temp.expense(p_edition TEXT, p_group UUID, p_amount NUMERIC) RETURNS VOID
LANGUAGE sql AS $$
  INSERT INTO polla_org_expenses (polla_organization_id, polla_group_id, date, name, amount, polla_edition_id)
  VALUES (pg_temp.org(), p_group, polla_today(), 'Gasto', p_amount, pg_temp.ed(p_edition));
$$;

SELECT pg_temp.edition('A');
SELECT pg_temp.edition('B');
SELECT pg_temp.edition('C');
UPDATE polla_editions SET account_by_edition = FALSE WHERE polla_edition_id = pg_temp.ed('C');

-- A: P1 deja 2 tickets (pase 200, comisión 20, subtotal 180); P2 deja 1 (subtotal 90).
SELECT pg_temp.bet('A', 1, 'T180-A1');
SELECT pg_temp.bet('A', 1, 'T180-A2');
SELECT pg_temp.bet('A', 2, 'T180-A3');
SELECT polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed('A'),
  ARRAY[pg_temp.cashier(1), pg_temp.cashier(2)], pg_temp.owner());

-- ------------------------------------------------------------- vista previa
SELECT is((polla_group_edition_account_preview(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A')))->>'cashiers_subtotal',
  '270.00', 'suma lo que dejaron P1 y P2');

-- Gasto de G1 en A por 50; uno de G1 en B y uno de G2 en A no cuentan.
SELECT pg_temp.expense('A', pg_temp.g1(), 50);
SELECT pg_temp.expense('B', pg_temp.g1(), 30);
SELECT pg_temp.expense('A', pg_temp.g2(), 20);
SELECT is((polla_group_edition_account_preview(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A')))->>'expenses',
  '50.00', 'solo los gastos de la edición y del grupo');
SELECT is((polla_group_edition_account_preview(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A')))->>'base',
  '220.00', 'base = subtotal - gastos');
SELECT is((polla_group_edition_account_preview(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A')))->'account',
  'null'::JSONB, 'sin cuenta guardada todavía');

-- --------------------------------------------------------------- liquidar
SELECT is((polla_liquidate_group_edition(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A'), 10, 0, 0, pg_temp.owner())).admin_commission,
  22.00::NUMERIC(12,2), 'comisión del admin: 10% de 220');
-- 12,345% se guarda 12,35: la comisión es 12,35% de 220 = 27,17 (con 12,345 daría 27,16).
SELECT is((polla_liquidate_group_edition(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A'), 12.345, 0, 0, pg_temp.owner())).admin_commission,
  27.17::NUMERIC(12,2), 'el % se redondea a 2 decimales antes de calcular la comisión');
SELECT is((polla_liquidate_group_edition(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A'), 10, 5, 3, pg_temp.owner())).total,
  24.00::NUMERIC(12,2), 'total = comisión + ajustes - pagado');
SELECT is((SELECT count(*) FROM polla_group_edition_accounts
           WHERE polla_group_id = pg_temp.g1() AND polla_edition_id = pg_temp.ed('A')),
  1::BIGINT, 'liquidar de nuevo la rehace');
SELECT is((polla_group_edition_account_preview(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A')))->'account'->>'total',
  '24.00', 'la vista previa trae la cuenta guardada');

-- Un gasto grande que supera el subtotal.
SELECT pg_temp.expense('A', pg_temp.g1(), 400);
SELECT is((polla_liquidate_group_edition(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A'), 10, 0, 0, pg_temp.owner())).admin_commission,
  0::NUMERIC(12,2), 'si los gastos superan, no cobra');
SELECT is((SELECT total FROM polla_group_edition_accounts
           WHERE polla_group_id = pg_temp.g1() AND polla_edition_id = pg_temp.ed('A')),
  0::NUMERIC(12,2), 'sin arrastre');

-- ------------------------------------------------------------ validaciones
SELECT throws_ok(
  $$SELECT polla_liquidate_group_edition(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A'), 101, 0, 0, pg_temp.owner())$$,
  'P0001', 'POLLA_GROUP_PERCENTAGE_INVALID', 'porcentaje fuera de rango');
SELECT throws_ok(
  $$SELECT polla_liquidate_group_edition(pg_temp.org(), pg_temp.g1(), pg_temp.ed('C'), 10, 0, 0, pg_temp.owner())$$,
  'P0001', 'POLLA_EDITION_ACCOUNT_DISABLED', 'edición que quedó por días');
SELECT throws_ok(
  $$SELECT polla_liquidate_group_edition(pg_temp.org(), gen_random_uuid(), pg_temp.ed('A'), 10, 0, 0, pg_temp.owner())$$,
  'P0001', 'POLLA_GROUP_NOT_FOUND', 'grupo inexistente');

-- P3 de G1 con un ticket y sin liquidar.
SELECT pg_temp.bet('A', 3, 'T180-A4');
SELECT throws_ok(
  $$SELECT polla_liquidate_group_edition(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A'), 10, 0, 0, pg_temp.owner())$$,
  'P0001', 'POLLA_GROUP_CASHIERS_PENDING', 'faltan pasadores');

-- P1 se pasa a G2 después de liquidarse: su subtotal sigue en G1.
-- (El trigger bloquea el cambio por la vía normal; se lo saltea para simularlo.)
SET LOCAL session_replication_role = replica;
UPDATE polla_users SET polla_group_id = pg_temp.g2() WHERE polla_user_id = pg_temp.cashier(1);
SET LOCAL session_replication_role = origin;
SELECT is((polla_group_edition_account_preview(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A')))->>'cashiers_subtotal',
  '270.00', 'el que cambió de grupo sigue en el de su liquidación');
SELECT is((polla_group_edition_account_preview(pg_temp.org(), pg_temp.g1(), pg_temp.ed('A')))->'pending_cashiers'->0->>'number',
  '3', 'P3 figura como pendiente');

-- ------------------------------------------------------------ borrar un grupo
-- G3 con el pasador P4 y G4 sin movimientos. Solo cuentan las ediciones por
-- edición: la cuenta por días (congelada) no bloquea.
INSERT INTO polla_groups (polla_group_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000180e003', pg_temp.org(), 'Grupo 3'),
       ('a9000000-0000-0000-0000-00000180e004', pg_temp.org(), 'Grupo 4');
INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
VALUES (pg_temp.cashier(4), 'CASHIER', 'Pasador 4', 4, pg_temp.org(), 'a9000000-0000-0000-0000-00000180e003', 10, 0);

-- P4 deja un ticket en B sin liquidar.
SELECT pg_temp.bet('B', 4, 'T180-B1');
SELECT throws_ok(
  $$SELECT polla_delete_group('a9000000-0000-0000-0000-00000180e003', pg_temp.owner())$$,
  'P0001', 'POLLA_GROUP_CASHIERS_PENDING', 'borrar: un pasador con movimiento sin liquidar en una edición');

-- P4 liquidado (subtotal 90), el grupo todavía no.
SELECT polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed('B'), ARRAY[pg_temp.cashier(4)], pg_temp.owner());
SELECT throws_ok(
  $$SELECT polla_delete_group('a9000000-0000-0000-0000-00000180e003', pg_temp.owner())$$,
  'P0001', 'POLLA_GROUP_ACCOUNT_OPEN', 'borrar: pasadores liquidados pero el grupo sin liquidar');

-- Grupo liquidado y después un gasto nuevo: la cuenta quedó vieja.
SELECT polla_liquidate_group_edition(pg_temp.org(), 'a9000000-0000-0000-0000-00000180e003', pg_temp.ed('B'), 10, 0, 0, pg_temp.owner());
SELECT pg_temp.expense('B', 'a9000000-0000-0000-0000-00000180e003', 15);
SELECT throws_ok(
  $$SELECT polla_delete_group('a9000000-0000-0000-0000-00000180e003', pg_temp.owner())$$,
  'P0001', 'POLLA_GROUP_ACCOUNT_OPEN', 'borrar: la liquidación del grupo quedó desactualizada');

-- Se liquida de nuevo y queda al día; una fila vieja por días sin liquidar no molesta.
SELECT polla_liquidate_group_edition(pg_temp.org(), 'a9000000-0000-0000-0000-00000180e003', pg_temp.ed('B'), 10, 0, 0, pg_temp.owner());
INSERT INTO polla_current_accounts (polla_user_id, user_name, user_number, polla_organization_id, polla_group_id, date, subtotal, is_liquidated)
VALUES (pg_temp.cashier(4), 'Pasador 4', 4, pg_temp.org(), 'a9000000-0000-0000-0000-00000180e003', polla_today() - 30, 500, FALSE);
SELECT lives_ok(
  $$SELECT polla_delete_group('a9000000-0000-0000-0000-00000180e003', pg_temp.owner())$$,
  'borrar: todo liquidado y al día, la cuenta por días sin liquidar no bloquea');
SELECT isnt((SELECT deleted_at FROM polla_groups WHERE polla_group_id = 'a9000000-0000-0000-0000-00000180e003'),
  NULL::TIMESTAMPTZ, 'el grupo quedó borrado');

-- Sin movimientos en ninguna edición no hay nada que liquidar.
SELECT lives_ok(
  $$SELECT polla_delete_group('a9000000-0000-0000-0000-00000180e004', pg_temp.owner())$$,
  'borrar: un grupo sin movimientos se borra');

SELECT * FROM finish();
ROLLBACK;
