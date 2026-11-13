-- R13: marcar tickets en Debe como pagados. Solo Debe → Pagado, con quién y
-- cuándo, y cada rol en su alcance: el pasador lo imputado a él, el admin su
-- grupo, el Súper y superadmin+ la organización; el jugador no.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(15);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('e0000000-0000-0000-0000-000000000013', 'pgTAP marcar pago');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number) VALUES
  ('e0000000-0000-0000-0000-0000000013e1', 'e0000000-0000-0000-0000-000000000013', 'Grupo A', 1),
  ('e0000000-0000-0000-0000-0000000013e2', 'e0000000-0000-0000-0000-000000000013', 'Grupo B', 2);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus) VALUES
  ('e0000000-0000-0000-0000-0000000013c1', 'CASHIER', 'Pasador A', 1,
   'e0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-0000000013e1', 0, 0),
  ('e0000000-0000-0000-0000-0000000013c2', 'CASHIER', 'Pasador B', 1,
   'e0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-0000000013e2', 0, 0);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, parent_polla_user_id) VALUES
  ('e0000000-0000-0000-0000-0000000013f1', 'PLAYER', 'Jugador A', 1,
   'e0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-0000000013e1',
   'e0000000-0000-0000-0000-0000000013c1');

INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id, polla_group_id) VALUES
  ('e0000000-0000-0000-0000-0000000013a1', 'ADMIN', 'Admin A',
   'e0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-0000000013e1'),
  ('e0000000-0000-0000-0000-0000000013a2', 'ASSISTANT', 'Súper', 'e0000000-0000-0000-0000-000000000013', NULL);

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('e0000000-0000-0000-0000-0000000013b1', 'e0000000-0000-0000-0000-000000000013', 'Nacional R13');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('e0000000-0000-0000-0000-0000000013b2', 'e0000000-0000-0000-0000-000000000013', 'Nocturna R13', '21:00');

CREATE TEMP TABLE ed AS
SELECT (polla_create_edition(
  'e0000000-0000-0000-0000-000000000013',
  jsonb_build_object(
    'start_date', polla_today() + 10, 'end_date', polla_today() + 15,
    'load_limit_date', polla_today() + 9, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ),
  jsonb_build_array(jsonb_build_object(
    'polla_lottery_id', 'e0000000-0000-0000-0000-0000000013b1',
    'polla_schedule_id', 'e0000000-0000-0000-0000-0000000013b2'))
)->>'polla_edition_id')::UUID AS id;

CREATE TEMP TABLE t (name TEXT PRIMARY KEY, id UUID);

-- Carga en Debe a nombre de `p_target` (el admin del grupo A o el Súper).
CREATE FUNCTION pg_temp.owed(p_name TEXT, p_actor UUID, p_target UUID, p_identifier TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO t VALUES (p_name, (polla_create_bet(
    (SELECT id FROM ed), p_actor, p_target,
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    NULL, FALSE, FALSE, NULL, p_identifier, 'OWED'
  )->'bet'->>'polla_bet_id')::UUID);
END;
$$;

CREATE FUNCTION pg_temp.id(p_name TEXT) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM t WHERE name = p_name;
$$;

CREATE FUNCTION pg_temp.status(p_name TEXT) RETURNS polla_payment_status_enum LANGUAGE sql AS $$
  SELECT payment_status FROM polla_bets WHERE polla_bet_id = pg_temp.id(p_name);
$$;

-- Grupo A: dos del jugador y uno del pasador. Grupo B: uno del pasador B.
SELECT pg_temp.owed('jugador1', 'e0000000-0000-0000-0000-0000000013a1', 'e0000000-0000-0000-0000-0000000013f1', NULL);
SELECT pg_temp.owed('jugador2', 'e0000000-0000-0000-0000-0000000013a1', 'e0000000-0000-0000-0000-0000000013f1', NULL);
SELECT pg_temp.owed('pasadorA', 'e0000000-0000-0000-0000-0000000013a1', 'e0000000-0000-0000-0000-0000000013c1', 'chicho');
SELECT pg_temp.owed('pasadorB', 'e0000000-0000-0000-0000-0000000013a2', 'e0000000-0000-0000-0000-0000000013c2', 'beto');

-- ---------------------------------------------------------- alcance

SELECT throws_ok(
  $$SELECT polla_mark_bets_paid('e0000000-0000-0000-0000-0000000013f1', ARRAY[pg_temp.id('jugador1')])$$,
  'P0001', 'POLLA_PAYMENT_FORBIDDEN',
  'el jugador no marca pagos'
);
SELECT throws_ok(
  $$SELECT polla_mark_bets_paid('e0000000-0000-0000-0000-0000000013c1', ARRAY[pg_temp.id('pasadorA'), pg_temp.id('pasadorB')])$$,
  'P0001', 'POLLA_BET_OUT_OF_SCOPE',
  'el pasador no marca tickets de otro pasador'
);
SELECT is(pg_temp.status('pasadorA'), 'OWED'::polla_payment_status_enum, 'y si falla uno no se marca ninguno');
SELECT throws_ok(
  $$SELECT polla_mark_bets_paid('e0000000-0000-0000-0000-0000000013a1', ARRAY[pg_temp.id('pasadorB')])$$,
  'P0001', 'POLLA_BET_OUT_OF_SCOPE',
  'el admin no marca tickets de otro grupo'
);
SELECT throws_ok(
  $$SELECT polla_mark_bets_paid('e0000000-0000-0000-0000-0000000013c1')$$,
  'P0001', 'POLLA_PAYMENT_TARGET_REQUIRED',
  'hay que decir qué tickets'
);

-- ---------------------------------------------- el pasador, por ticket

CREATE TEMP TABLE r1 AS
SELECT polla_mark_bets_paid('e0000000-0000-0000-0000-0000000013c1', ARRAY[pg_temp.id('pasadorA')]) AS r;

SELECT is((SELECT (r->>'updated')::INT FROM r1), 1, 'el pasador marca su ticket');
SELECT is(pg_temp.status('pasadorA'), 'PAID'::polla_payment_status_enum, 'queda pagado');
SELECT is(
  (SELECT paid_by FROM polla_bets WHERE polla_bet_id = pg_temp.id('pasadorA')),
  'e0000000-0000-0000-0000-0000000013c1'::UUID,
  'cobrado por el pasador'
);
SELECT is(
  (SELECT payment_method FROM polla_bets WHERE polla_bet_id = pg_temp.id('pasadorA')),
  'CASH'::polla_payment_method_enum,
  'en efectivo'
);

-- Marcarlo de nuevo no lo cambia (ni lo vuelve a Debe).
CREATE TEMP TABLE r2 AS
SELECT polla_mark_bets_paid('e0000000-0000-0000-0000-0000000013a2', ARRAY[pg_temp.id('pasadorA')]) AS r;
SELECT is((SELECT (r->>'updated')::INT FROM r2), 0, 'uno ya pagado no se vuelve a marcar');
SELECT is(
  (SELECT paid_by FROM polla_bets WHERE polla_bet_id = pg_temp.id('pasadorA')),
  'e0000000-0000-0000-0000-0000000013c1'::UUID,
  'y conserva quién lo cobró'
);

-- --------------------------------- todos los impagos de un jugador

CREATE TEMP TABLE r3 AS
SELECT polla_mark_bets_paid(
  'e0000000-0000-0000-0000-0000000013a1', NULL, (SELECT id FROM ed), 'e0000000-0000-0000-0000-0000000013f1'
) AS r;

SELECT is((SELECT (r->>'updated')::INT FROM r3), 2, 'el admin marca los dos impagos del jugador');
SELECT is((SELECT (r->>'amount')::NUMERIC FROM r3), 200::NUMERIC, 'y devuelve cuánto cobró');
SELECT is(pg_temp.status('pasadorB'), 'OWED'::polla_payment_status_enum, 'lo de otro jugador sigue en Debe');

-- El Súper marca en toda la organización.
SELECT is(
  (SELECT (polla_mark_bets_paid('e0000000-0000-0000-0000-0000000013a2', ARRAY[pg_temp.id('pasadorB')])->>'updated')::INT),
  1,
  'el Súper marca en cualquier grupo'
);

SELECT * FROM finish();
ROLLBACK;
