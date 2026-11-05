-- Regresión de la carga (R05, R07, R08) y de la numeración (R09), ahora con
-- una edición de varios sorteos: el corte sale del sorteo más temprano.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(16);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('c0000000-0000-0000-0000-000000000005', 'pgTAP carga');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number) VALUES
  ('c0000000-0000-0000-0000-0000000005e1', 'c0000000-0000-0000-0000-000000000005', 'Grupo 3', 3),
  ('c0000000-0000-0000-0000-0000000005e2', 'c0000000-0000-0000-0000-000000000005', 'Grupo 4', 4);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus) VALUES
  ('c0000000-0000-0000-0000-0000000005c1', 'CASHIER', 'Pasador cinco', 5,
   'c0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-0000000005e1', 0, 0),
  ('c0000000-0000-0000-0000-0000000005c2', 'CASHIER', 'Pasador seis', 6,
   'c0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-0000000005e1', 0, 0);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, parent_polla_user_id) VALUES
  ('c0000000-0000-0000-0000-0000000005f1', 'PLAYER', 'Ana', 2,
   'c0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-0000000005e1',
   'c0000000-0000-0000-0000-0000000005c1'),
  ('c0000000-0000-0000-0000-0000000005f2', 'PLAYER', 'Beto', 1,
   'c0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-0000000005e1',
   'c0000000-0000-0000-0000-0000000005c2');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name, "order") VALUES
  ('c0000000-0000-0000-0000-0000000005a1', 'c0000000-0000-0000-0000-000000000005', 'Nacional carga', 1),
  ('c0000000-0000-0000-0000-0000000005a2', 'c0000000-0000-0000-0000-000000000005', 'Provincia carga', 2);

INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time) VALUES
  ('c0000000-0000-0000-0000-0000000005b1', 'c0000000-0000-0000-0000-000000000005', 'Nocturna carga', '21:00'),
  ('c0000000-0000-0000-0000-0000000005b2', 'c0000000-0000-0000-0000-000000000005', 'Vespertina carga', '18:00');

-- Especial con sorteos a las 18 y a las 21, que arranca en 10 días. Cierra
-- para pasadores ese mismo día a las 17.
CREATE TEMP TABLE ed AS
SELECT (polla_create_edition(
  'c0000000-0000-0000-0000-000000000005',
  jsonb_build_object(
    'start_date', polla_today() + 10,
    'end_date', polla_today() + 10,
    'load_limit_date', polla_today() + 10,
    'load_limit_time', '17:00',
    'pool_amount', 1000,
    'ticket_price', 100,
    'min_winning_hits', 8
  ),
  jsonb_build_array(
    jsonb_build_object('polla_lottery_id', 'c0000000-0000-0000-0000-0000000005a1',
                       'polla_schedule_id', 'c0000000-0000-0000-0000-0000000005b1'),
    jsonb_build_object('polla_lottery_id', 'c0000000-0000-0000-0000-0000000005a2',
                       'polla_schedule_id', 'c0000000-0000-0000-0000-0000000005b1'),
    jsonb_build_object('polla_lottery_id', 'c0000000-0000-0000-0000-0000000005a1',
                       'polla_schedule_id', 'c0000000-0000-0000-0000-0000000005b2')
  )
)->>'polla_edition_id')::UUID AS id;

CREATE FUNCTION pg_temp.bet(p_actor UUID, p_target UUID, p_identifier TEXT) RETURNS JSONB LANGUAGE sql AS $$
  SELECT polla_create_bet(
    (SELECT id FROM ed), p_actor, p_target,
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    NULL, FALSE, FALSE, NULL, p_identifier
  )->'bet';
$$;

-- ---------------------------------------------------------- corte de carga

SELECT is(
  (SELECT polla_load_cutoff(e, 'CASHIER') FROM polla_editions e WHERE e.polla_edition_id = (SELECT id FROM ed)),
  (polla_today() + 10) + '17:00'::TIME,
  'el pasador carga hasta el cierre de la edición'
);
SELECT is(
  (SELECT polla_load_cutoff(e, 'ADMIN') FROM polla_editions e WHERE e.polla_edition_id = (SELECT id FROM ed)),
  (polla_today() + 10) + '18:00'::TIME,
  'el admin carga hasta el sorteo más temprano de la especial'
);
SELECT is(
  (SELECT COUNT(*)::INT FROM polla_loadable_editions('c0000000-0000-0000-0000-000000000005', 'CASHIER') x
   WHERE jsonb_array_length(x->'draws') = 3),
  1,
  'Cargar jugada recibe la edición con sus 3 sorteos'
);

-- -------------------------------------- R05: el pasador carga a su jugador

CREATE TEMP TABLE to_player AS
SELECT pg_temp.bet('c0000000-0000-0000-0000-0000000005c1', 'c0000000-0000-0000-0000-0000000005f1', NULL) AS b;

SELECT is((SELECT b->>'user_name' FROM to_player), 'Ana', 'R05: el ticket queda a nombre del jugador');
SELECT is(
  (SELECT (b->>'cashier_polla_user_id')::UUID FROM to_player),
  'c0000000-0000-0000-0000-0000000005c1'::UUID,
  'R05: imputado a su pasador'
);
SELECT matches(
  (SELECT b->>'ticket_number' FROM to_player),
  '^3-\d{17}-5-2$',
  'el número de ticket lleva grupo, pasador y jugador'
);
SELECT is((SELECT b->>'identifier' FROM to_player), NULL, 'R08: con jugador no hace falta identificador');

SELECT throws_ok(
  $$SELECT pg_temp.bet('c0000000-0000-0000-0000-0000000005c1', 'c0000000-0000-0000-0000-0000000005f2', NULL)$$,
  'P0001',
  'POLLA_BET_TARGET_FORBIDDEN',
  'R05: no carga a jugadores de otro pasador'
);

-- ------------------------- R07: sin jugador, el ticket lleva identificador

SELECT throws_ok(
  $$SELECT pg_temp.bet('c0000000-0000-0000-0000-0000000005c1', 'c0000000-0000-0000-0000-0000000005c1', '  ')$$,
  'P0001',
  'POLLA_BET_IDENTIFIER_REQUIRED',
  'R07: a nombre del pasador, sin identificador no se carga'
);
SELECT is(
  (SELECT pg_temp.bet('c0000000-0000-0000-0000-0000000005c1', 'c0000000-0000-0000-0000-0000000005c1', ' chicho ')->>'identifier'),
  'chicho',
  'R07: el identificador queda en el ticket'
);
SELECT is(
  (SELECT bets_count FROM polla_editions WHERE polla_edition_id = (SELECT id FROM ed)),
  2,
  'la edición cuenta los dos tickets cargados'
);

-- ------------------------------------------- R09: números desde el 1

SELECT lives_ok(
  $$INSERT INTO polla_users (user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
    VALUES ('CASHIER', 'Pasador uno G4', 1, 'c0000000-0000-0000-0000-000000000005',
            'c0000000-0000-0000-0000-0000000005e2', 0, 0)$$,
  'R09: cada grupo numera sus pasadores desde el 1'
);
SELECT lives_ok(
  $$INSERT INTO polla_users (user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
    VALUES ('CASHIER', 'Pasador uno G3', 1, 'c0000000-0000-0000-0000-000000000005',
            'c0000000-0000-0000-0000-0000000005e1', 0, 0)$$,
  'R09: el 1 se repite en otro grupo'
);
SELECT throws_ok(
  $$INSERT INTO polla_users (user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
    VALUES ('CASHIER', 'Otro cinco', 5, 'c0000000-0000-0000-0000-000000000005',
            'c0000000-0000-0000-0000-0000000005e1', 0, 0)$$,
  '23505',
  NULL,
  'R09: en el mismo grupo no se repite'
);
SELECT lives_ok(
  $$INSERT INTO polla_users (user_type, name, number, polla_organization_id, polla_group_id, parent_polla_user_id)
    VALUES ('PLAYER', 'Carla', 1, 'c0000000-0000-0000-0000-000000000005',
            'c0000000-0000-0000-0000-0000000005e1', 'c0000000-0000-0000-0000-0000000005c1')$$,
  'R09: cada pasador numera sus jugadores desde el 1'
);
SELECT throws_ok(
  $$INSERT INTO polla_users (user_type, name, number, polla_organization_id, polla_group_id, parent_polla_user_id)
    VALUES ('PLAYER', 'Dani', 2, 'c0000000-0000-0000-0000-000000000005',
            'c0000000-0000-0000-0000-0000000005e1', 'c0000000-0000-0000-0000-0000000005c1')$$,
  '23505',
  NULL,
  'R09: el mismo pasador no repite número de jugador'
);

SELECT * FROM finish();
ROLLBACK;
