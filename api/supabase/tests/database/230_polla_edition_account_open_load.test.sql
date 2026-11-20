-- Pollas con la carga abierta en "Pollas a liquidar" (20261116074720): entran en la
-- lista si ya empezaron (con `load_open`), los cobros y pagos se cargan con la
-- carga abierta, y generar la liquidación, liquidar el grupo o marcar la edición
-- como liquidada siguen bloqueados hasta que la carga cierre.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(15);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-000000000230', 'pgTAP carga abierta');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000230e001', 'a9000000-0000-0000-0000-000000000230', 'Grupo 230');

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
VALUES ('a9000000-0000-0000-0000-00000230c001', 'CASHIER', 'Pasador 1', 1,
        'a9000000-0000-0000-0000-000000000230', 'a9000000-0000-0000-0000-00000230e001', 10, 0);
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a9000000-0000-0000-0000-00000230d001', 'OWNER', 'Dueño 230', 'a9000000-0000-0000-0000-000000000230');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000230a001', 'a9000000-0000-0000-0000-000000000230', 'Nacional 230');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a9000000-0000-0000-0000-00000230b001', 'a9000000-0000-0000-0000-000000000230', 'Nocturna 230', '23:59:59');

CREATE TEMP TABLE eds (name TEXT PRIMARY KEY, id UUID NOT NULL);

-- Todas nacen con la carga abierta; "A" se pasa al pasado y "B" empieza hoy.
CREATE FUNCTION pg_temp.edition(p_name TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := (polla_create_edition(
    'a9000000-0000-0000-0000-000000000230',
    jsonb_build_object(
      'name', p_name, 'start_date', polla_today() + 1, 'end_date', polla_today() + 5,
      'load_limit_date', polla_today() + 1, 'load_limit_time', '20:00',
      'pool_amount', 1000, 'ticket_price', 100
    ),
    jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', 'a9000000-0000-0000-0000-00000230a001',
      'polla_schedule_id', 'a9000000-0000-0000-0000-00000230b001'))
  )->>'polla_edition_id')::UUID;
  INSERT INTO eds VALUES (p_name, v_id);
END;
$$;

CREATE FUNCTION pg_temp.ed(p_name TEXT) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM eds WHERE name = p_name;
$$;

SELECT pg_temp.edition('A');
SELECT pg_temp.edition('B');
SELECT pg_temp.edition('C');

UPDATE polla_editions
SET load_start_date = polla_today() - 20, load_limit_date = polla_today() - 12,
    start_date = polla_today() - 10, end_date = polla_today() + 5
WHERE polla_edition_id = pg_temp.ed('A');
UPDATE polla_editions
-- El sorteo es a las 23:59:59: la carga sigue abierta todo el día de inicio.
SET load_start_date = polla_today() - 5, load_limit_date = polla_today(), load_limit_time = '23:59:58',
    start_date = polla_today(), end_date = polla_today() + 5
WHERE polla_edition_id = pg_temp.ed('B');

CREATE FUNCTION pg_temp.item(p_edition TEXT) RETURNS JSONB LANGUAGE sql AS $$
  SELECT j FROM polla_edition_account_list('a9000000-0000-0000-0000-000000000230', FALSE, NULL, NULL, FALSE) j
  WHERE (j->>'polla_edition_id')::UUID = pg_temp.ed(p_edition);
$$;

-- ------------------------------------------------------------ la lista

SELECT ok(pg_temp.item('A') IS NOT NULL, 'la lista trae la edición con la carga cerrada');
SELECT ok(pg_temp.item('B') IS NOT NULL, 'y la que ya empezó con la carga abierta');
SELECT ok(pg_temp.item('C') IS NULL, 'pero no la que todavía no empezó');
SELECT is((pg_temp.item('B')->>'load_open')::BOOLEAN, TRUE, 'load_open: la carga abierta');
SELECT is((pg_temp.item('A')->>'load_open')::BOOLEAN, FALSE, 'load_open: la carga cerrada');

-- ------------------------------------------------------------ movimientos

SELECT lives_ok(
  $$INSERT INTO polla_edition_account_movements (
      polla_organization_id, polla_edition_id, polla_user_id, type, amount, date, created_by
    ) VALUES (
      'a9000000-0000-0000-0000-000000000230', (SELECT id FROM eds WHERE name = 'B'),
      'a9000000-0000-0000-0000-00000230c001', 'COLLECTION', 50, polla_today(),
      'a9000000-0000-0000-0000-00000230d001')$$,
  'carga un cobro con la carga abierta');

-- ------------------------------------------------------------ liquidar sigue bloqueado

SELECT throws_ok(
  $$SELECT polla_generate_edition_liquidation('a9000000-0000-0000-0000-000000000230',
      (SELECT id FROM eds WHERE name = 'B'), 'a9000000-0000-0000-0000-00000230d001',
      jsonb_build_array(jsonb_build_object(
        'polla_user_id', 'a9000000-0000-0000-0000-00000230c001', 'collection', 70)))$$,
  'POLLA_EDITION_LOAD_OPEN', 'generar la liquidación con la carga abierta falla');

-- Sin assert de "el generar fallido no deja movimientos": throws_ok corre la
-- llamada en una subtransacción (igual que un bloque EXCEPTION de plpgsql), así
-- que cualquier versión que termine tirando el error deja la cuenta igual y el
-- assert no podría fallar. Que no queden los movimientos que el generar inserta
-- antes de liquidar sale de que el RPC corre en una sola transacción; lo
-- verifica el E2E contra la API.

SELECT throws_ok(
  $$SELECT polla_liquidate_group_edition('a9000000-0000-0000-0000-000000000230',
      'a9000000-0000-0000-0000-00000230e001', (SELECT id FROM eds WHERE name = 'B'),
      10, 0, 0, 0, 0, 'a9000000-0000-0000-0000-00000230d001')$$,
  'POLLA_EDITION_LOAD_OPEN', 'liquidar el grupo con la carga abierta falla');

-- ------------------------------------------------------------ marcar como liquidada

SELECT throws_ok(
  $$SELECT polla_set_edition_liquidated('a9000000-0000-0000-0000-000000000230',
      (SELECT id FROM eds WHERE name = 'B'), 'a9000000-0000-0000-0000-00000230d001', TRUE)$$,
  'POLLA_EDITION_LOAD_OPEN', 'marcar como liquidada con la carga abierta falla');

SELECT lives_ok(
  $$SELECT polla_set_edition_liquidated('a9000000-0000-0000-0000-000000000230',
      (SELECT id FROM eds WHERE name = 'A'), 'a9000000-0000-0000-0000-00000230d001', TRUE)$$,
  'con la carga cerrada se marca como liquidada');

SELECT is(
  (SELECT liquidated_at IS NOT NULL FROM polla_editions WHERE polla_edition_id = pg_temp.ed('A')),
  TRUE, 'y queda marcada');

SELECT lives_ok(
  $$SELECT polla_set_edition_liquidated('a9000000-0000-0000-0000-000000000230',
      (SELECT id FROM eds WHERE name = 'A'), 'a9000000-0000-0000-0000-00000230d001', FALSE)$$,
  'se desmarca');

SELECT lives_ok(
  $$SELECT polla_set_edition_liquidated('a9000000-0000-0000-0000-000000000230',
      (SELECT id FROM eds WHERE name = 'B'), 'a9000000-0000-0000-0000-00000230d001', FALSE)$$,
  'desmarcar anda también con la carga abierta');

-- ------------------------------------------------------------ grupo: edición inexistente

SELECT throws_ok(
  $$SELECT polla_liquidate_group_edition('a9000000-0000-0000-0000-000000000230',
      'a9000000-0000-0000-0000-00000230e001', gen_random_uuid(),
      10, 0, 0, 0, 0, 'a9000000-0000-0000-0000-00000230d001')$$,
  'POLLA_EDITION_NOT_FOUND', 'liquidar el grupo de una edición que no existe falla');

-- C tiene la carga abierta: sin el filtro de borradas tiraría POLLA_EDITION_LOAD_OPEN.
UPDATE polla_editions SET deleted_at = NOW() WHERE polla_edition_id = pg_temp.ed('C');

SELECT throws_ok(
  $$SELECT polla_liquidate_group_edition('a9000000-0000-0000-0000-000000000230',
      'a9000000-0000-0000-0000-00000230e001', (SELECT id FROM eds WHERE name = 'C'),
      10, 0, 0, 0, 0, 'a9000000-0000-0000-0000-00000230d001')$$,
  'POLLA_EDITION_NOT_FOUND', 'y la de una edición borrada también');

SELECT * FROM finish();
ROLLBACK;
