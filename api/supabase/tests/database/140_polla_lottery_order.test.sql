-- R28: cada organización define el orden de sus quinielas. La posición da el
-- número de "1 - Nacional"; los sorteos de una edición van por horario del
-- turno y después por posición de la quiniela.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

INSERT INTO polla_organizations (polla_organization_id, name) VALUES
  ('a7000000-0000-0000-0000-000000000028', 'pgTAP orden R28'),
  ('a7000000-0000-0000-0000-000000000029', 'pgTAP otra org R28');

-- Se cargan sin orden (0): la base las pone al final, en el orden de alta.
INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name) VALUES
  ('a7000000-0000-0000-0000-0000000028b1', 'a7000000-0000-0000-0000-000000000028', 'Córdoba T');
INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name) VALUES
  ('a7000000-0000-0000-0000-0000000028b2', 'a7000000-0000-0000-0000-000000000028', 'Nacional T');
INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name) VALUES
  ('a7000000-0000-0000-0000-0000000028b3', 'a7000000-0000-0000-0000-000000000028', 'Provincia T');
INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name) VALUES
  ('a7000000-0000-0000-0000-0000000029b1', 'a7000000-0000-0000-0000-000000000029', 'Otra org');

INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time) VALUES
  ('a7000000-0000-0000-0000-0000000028c1', 'a7000000-0000-0000-0000-000000000028', 'Nocturna T', '21:00'),
  ('a7000000-0000-0000-0000-0000000028c2', 'a7000000-0000-0000-0000-000000000028', 'Matutina T', '11:30');

CREATE FUNCTION pg_temp.labels() RETURNS TEXT[] LANGUAGE sql AS $$
  SELECT array_agg(label ORDER BY "position")
  FROM polla_lottery_positions('a7000000-0000-0000-0000-000000000028');
$$;

SELECT is(
  pg_temp.labels(),
  ARRAY['1 - Córdoba T', '2 - Nacional T', '3 - Provincia T'],
  'una quiniela nueva va al final y la etiqueta lleva su posición'
);
SELECT is(
  (SELECT label FROM polla_lottery_positions('a7000000-0000-0000-0000-000000000029')),
  '1 - Otra org',
  'cada organización numera las suyas'
);

-- ------------------------------------------------------------ reordenar

SELECT lives_ok(
  $$SELECT polla_reorder_lotteries('a7000000-0000-0000-0000-000000000028', ARRAY[
      'a7000000-0000-0000-0000-0000000028b2', 'a7000000-0000-0000-0000-0000000028b3',
      'a7000000-0000-0000-0000-0000000028b1']::UUID[])$$,
  'la organización elige el orden'
);
SELECT is(
  pg_temp.labels(),
  ARRAY['1 - Nacional T', '2 - Provincia T', '3 - Córdoba T'],
  'y queda guardado'
);
SELECT throws_ok(
  $$SELECT polla_reorder_lotteries('a7000000-0000-0000-0000-000000000028', ARRAY[
      'a7000000-0000-0000-0000-0000000028b2', 'a7000000-0000-0000-0000-0000000028b3']::UUID[])$$,
  'P0001', 'POLLA_LOTTERY_ORDER_INVALID',
  'si falta una no cambia nada'
);
SELECT throws_ok(
  $$SELECT polla_reorder_lotteries('a7000000-0000-0000-0000-000000000028', ARRAY[
      'a7000000-0000-0000-0000-0000000028b2', 'a7000000-0000-0000-0000-0000000028b2',
      'a7000000-0000-0000-0000-0000000028b1']::UUID[])$$,
  'P0001', 'POLLA_LOTTERY_ORDER_INVALID',
  'ni si se repite una'
);
SELECT throws_ok(
  $$SELECT polla_reorder_lotteries('a7000000-0000-0000-0000-000000000028', ARRAY[
      'a7000000-0000-0000-0000-0000000028b2', 'a7000000-0000-0000-0000-0000000028b3',
      'a7000000-0000-0000-0000-0000000029b1']::UUID[])$$,
  'P0001', 'POLLA_LOTTERY_ORDER_INVALID',
  'ni con una de otra organización'
);
SELECT is(
  pg_temp.labels(),
  ARRAY['1 - Nacional T', '2 - Provincia T', '3 - Córdoba T'],
  'el orden guardado sigue igual'
);

-- ---------------------------------------------------- en las ediciones

CREATE TEMP TABLE ed AS
SELECT polla_create_edition(
  'a7000000-0000-0000-0000-000000000028',
  jsonb_build_object(
    'start_date', polla_today() + 10, 'end_date', polla_today() + 10,
    'load_limit_date', polla_today() + 9, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ),
  jsonb_build_array(
    jsonb_build_object('polla_lottery_id', 'a7000000-0000-0000-0000-0000000028b1', 'polla_schedule_id', 'a7000000-0000-0000-0000-0000000028c1'),
    jsonb_build_object('polla_lottery_id', 'a7000000-0000-0000-0000-0000000028b2', 'polla_schedule_id', 'a7000000-0000-0000-0000-0000000028c1'),
    jsonb_build_object('polla_lottery_id', 'a7000000-0000-0000-0000-0000000028b3', 'polla_schedule_id', 'a7000000-0000-0000-0000-0000000028c2'),
    jsonb_build_object('polla_lottery_id', 'a7000000-0000-0000-0000-0000000028b2', 'polla_schedule_id', 'a7000000-0000-0000-0000-0000000028c2')
  )
) AS e;

SELECT is(
  (SELECT array_agg(d->>'lottery_label' ORDER BY i) FROM ed, jsonb_array_elements(e->'draws') WITH ORDINALITY AS x(d, i)),
  ARRAY['1 - Nacional T', '2 - Provincia T', '1 - Nacional T', '3 - Córdoba T'],
  'los sorteos van por horario del turno (matutina, nocturna) y después por posición'
);
SELECT is(
  (SELECT (e->'draws'->0->>'lottery_position')::INT FROM ed),
  1,
  'cada sorteo trae la posición de su quiniela'
);

-- Al reordenar, la edición se ve con el orden nuevo.
SELECT polla_reorder_lotteries('a7000000-0000-0000-0000-000000000028', ARRAY[
  'a7000000-0000-0000-0000-0000000028b1', 'a7000000-0000-0000-0000-0000000028b2',
  'a7000000-0000-0000-0000-0000000028b3']::UUID[]);
SELECT is(
  (SELECT array_agg(d->>'lottery_label' ORDER BY i)
   FROM polla_editions pe,
        jsonb_array_elements(polla_edition_with_draws(pe)->'draws') WITH ORDINALITY AS x(d, i)
   WHERE pe.polla_edition_id = (SELECT (e->>'polla_edition_id')::UUID FROM ed)),
  ARRAY['2 - Nacional T', '3 - Provincia T', '1 - Córdoba T', '2 - Nacional T'],
  'con el orden nuevo, la edición lo sigue'
);

-- ------------------------------------------------- borrar y agregar

UPDATE polla_lotteries SET deleted_at = NOW() WHERE polla_lottery_id = 'a7000000-0000-0000-0000-0000000028b1';
SELECT is(
  pg_temp.labels(),
  ARRAY['1 - Nacional T', '2 - Provincia T'],
  'al borrar una, las demás se renumeran'
);
INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a7000000-0000-0000-0000-0000000028b4', 'a7000000-0000-0000-0000-000000000028', 'Entre Ríos T');
SELECT is(
  pg_temp.labels(),
  ARRAY['1 - Nacional T', '2 - Provincia T', '3 - Entre Ríos T'],
  'una nueva queda última'
);
SELECT throws_ok(
  $$SELECT polla_reorder_lotteries('a7000000-0000-0000-0000-000000000028', ARRAY[
      'a7000000-0000-0000-0000-0000000028b1', 'a7000000-0000-0000-0000-0000000028b2',
      'a7000000-0000-0000-0000-0000000028b3']::UUID[])$$,
  'P0001', 'POLLA_LOTTERY_ORDER_INVALID',
  'una borrada no entra en el orden'
);

SELECT * FROM finish();
ROLLBACK;
