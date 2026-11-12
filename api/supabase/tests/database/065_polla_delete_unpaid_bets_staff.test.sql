-- R14 (ajuste del 10/11): "Eliminar impagos" también para el admin de grupo,
-- el superadmin, el capitalista y el dueño. Eligen pasador y/o jugador; el
-- admin, solo de su grupo. El Súper no. Mismo corte para todos (cierre de
-- carga) y cada baja entra en Borradas de su pasador.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(19);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('f1000000-0000-0000-0000-000000000014', 'pgTAP impagos staff');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number) VALUES
  ('f1000000-0000-0000-0000-0000000014e1', 'f1000000-0000-0000-0000-000000000014', 'Grupo uno', 1),
  ('f1000000-0000-0000-0000-0000000014e2', 'f1000000-0000-0000-0000-000000000014', 'Grupo dos', 2);

-- Pasadores: c1 y c2 en el grupo uno, c3 en el grupo dos.
INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus) VALUES
  ('f1000000-0000-0000-0000-0000000014c1', 'CASHIER', 'Pasador uno', 1,
   'f1000000-0000-0000-0000-000000000014', 'f1000000-0000-0000-0000-0000000014e1', 0, 0),
  ('f1000000-0000-0000-0000-0000000014c2', 'CASHIER', 'Pasador dos', 2,
   'f1000000-0000-0000-0000-000000000014', 'f1000000-0000-0000-0000-0000000014e1', 0, 0),
  ('f1000000-0000-0000-0000-0000000014c3', 'CASHIER', 'Pasador tres', 1,
   'f1000000-0000-0000-0000-000000000014', 'f1000000-0000-0000-0000-0000000014e2', 0, 0);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, parent_polla_user_id) VALUES
  ('f1000000-0000-0000-0000-0000000014f1', 'PLAYER', 'Jugador de c1', 1,
   'f1000000-0000-0000-0000-000000000014', 'f1000000-0000-0000-0000-0000000014e1',
   'f1000000-0000-0000-0000-0000000014c1'),
  ('f1000000-0000-0000-0000-0000000014f3', 'PLAYER', 'Jugador de c3', 2,
   'f1000000-0000-0000-0000-000000000014', 'f1000000-0000-0000-0000-0000000014e2',
   'f1000000-0000-0000-0000-0000000014c3');

INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id, polla_group_id) VALUES
  ('f1000000-0000-0000-0000-0000000014a1', 'ADMIN', 'Admin grupo uno',
   'f1000000-0000-0000-0000-000000000014', 'f1000000-0000-0000-0000-0000000014e1'),
  ('f1000000-0000-0000-0000-0000000014a2', 'SUPERADMIN', 'Superadmin', 'f1000000-0000-0000-0000-000000000014', NULL),
  ('f1000000-0000-0000-0000-0000000014a3', 'CAPITALIST', 'Capitalista', 'f1000000-0000-0000-0000-000000000014', NULL),
  ('f1000000-0000-0000-0000-0000000014a4', 'OWNER', 'Dueño', 'f1000000-0000-0000-0000-000000000014', NULL),
  ('f1000000-0000-0000-0000-0000000014a5', 'ASSISTANT', 'Súper', 'f1000000-0000-0000-0000-000000000014', NULL);

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('f1000000-0000-0000-0000-0000000014b1', 'f1000000-0000-0000-0000-000000000014', 'Nacional R14 staff');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('f1000000-0000-0000-0000-0000000014b2', 'f1000000-0000-0000-0000-000000000014', 'Nocturna R14 staff', '21:00');

CREATE TEMP TABLE ed AS
SELECT (polla_create_edition(
  'f1000000-0000-0000-0000-000000000014',
  jsonb_build_object(
    'start_date', polla_today() + 10, 'end_date', polla_today() + 15,
    'load_limit_date', polla_today() + 9, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ),
  jsonb_build_array(jsonb_build_object(
    'polla_lottery_id', 'f1000000-0000-0000-0000-0000000014b1',
    'polla_schedule_id', 'f1000000-0000-0000-0000-0000000014b2'))
)->>'polla_edition_id')::UUID AS id;

CREATE TEMP TABLE t (name TEXT PRIMARY KEY, id UUID);

CREATE FUNCTION pg_temp.bet(
  p_name TEXT, p_actor UUID, p_target UUID, p_identifier TEXT, p_payment polla_payment_status_enum
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO t VALUES (p_name, (polla_create_bet(
    (SELECT id FROM ed), p_actor, p_target,
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    NULL, FALSE, FALSE, NULL, p_identifier, p_payment
  )->'bet'->>'polla_bet_id')::UUID);
END;
$$;

CREATE FUNCTION pg_temp.deleted(p_name TEXT) RETURNS BOOLEAN LANGUAGE sql AS $$
  SELECT deleted_at IS NOT NULL FROM polla_bets WHERE polla_bet_id = (SELECT id FROM t WHERE name = p_name);
$$;

-- c1: un impago de su jugador y uno propio. c2: un impago. c3: un impago de su
-- jugador y uno pagado.
SELECT pg_temp.bet('c1_jugador', 'f1000000-0000-0000-0000-0000000014c1', 'f1000000-0000-0000-0000-0000000014f1', NULL, 'OWED');
SELECT pg_temp.bet('c1_propio', 'f1000000-0000-0000-0000-0000000014c1', 'f1000000-0000-0000-0000-0000000014c1', 'chicho', 'OWED');
SELECT pg_temp.bet('c2', 'f1000000-0000-0000-0000-0000000014c2', 'f1000000-0000-0000-0000-0000000014c2', 'beto', 'OWED');
SELECT pg_temp.bet('c3_jugador', 'f1000000-0000-0000-0000-0000000014c3', 'f1000000-0000-0000-0000-0000000014f3', NULL, 'OWED');
SELECT pg_temp.bet('c3_pagado', 'f1000000-0000-0000-0000-0000000014c3', 'f1000000-0000-0000-0000-0000000014f3', NULL, 'PAID');

-- La cuenta de hoy calculada; c2 ya liquidado hoy.
SELECT polla_calculate_current_account(
  to_char(polla_today(), 'DD-MM-YYYY'), FALSE, FALSE, 'f1000000-0000-0000-0000-000000000014'
);
UPDATE polla_current_accounts
SET is_liquidated = TRUE
WHERE polla_user_id = 'f1000000-0000-0000-0000-0000000014c2' AND date = polla_today();

-- -------------------------------------------------------------- quién

SELECT throws_ok(
  $$SELECT polla_unpaid_bets_summary('f1000000-0000-0000-0000-0000000014a5', (SELECT id FROM ed), NULL,
      'f1000000-0000-0000-0000-0000000014c1')$$,
  'P0001', 'POLLA_UNPAID_DELETE_FORBIDDEN',
  'el Súper no borra impagos'
);
SELECT throws_ok(
  $$SELECT polla_unpaid_bets_summary('f1000000-0000-0000-0000-0000000014c1', (SELECT id FROM ed), NULL,
      'f1000000-0000-0000-0000-0000000014c2')$$,
  'P0001', 'POLLA_BET_TARGET_FORBIDDEN',
  'el pasador no borra lo de otro pasador'
);
SELECT throws_ok(
  $$SELECT polla_unpaid_bets_summary('f1000000-0000-0000-0000-0000000014a2', (SELECT id FROM ed))$$,
  'P0001', 'POLLA_UNPAID_DELETE_TARGET_REQUIRED',
  'el staff tiene que elegir pasador o jugador'
);
SELECT throws_ok(
  $$SELECT polla_delete_unpaid_bets('f1000000-0000-0000-0000-0000000014a1', (SELECT id FROM ed), NULL,
      'f1000000-0000-0000-0000-0000000014c3')$$,
  'P0001', 'POLLA_USER_OTHER_GROUP',
  'el admin no borra a un pasador de otro grupo'
);
SELECT throws_ok(
  $$SELECT polla_delete_unpaid_bets('f1000000-0000-0000-0000-0000000014a1', (SELECT id FROM ed),
      'f1000000-0000-0000-0000-0000000014f3')$$,
  'P0001', 'POLLA_USER_OTHER_GROUP',
  'ni a un jugador de otro grupo'
);
SELECT ok(NOT pg_temp.deleted('c3_jugador'), 'lo del otro grupo queda intacto');

-- ------------------------------------------------- admin de su grupo

CREATE TEMP TABLE s1 AS
SELECT polla_unpaid_bets_summary('f1000000-0000-0000-0000-0000000014a1', (SELECT id FROM ed), NULL,
  'f1000000-0000-0000-0000-0000000014c1') AS s;
SELECT is((SELECT (s->>'count')::INT FROM s1), 2, 'el admin ve los 2 impagos del pasador uno');
SELECT is((SELECT (s->>'amount')::NUMERIC FROM s1), 200::NUMERIC, 'y cuánto suman');

CREATE TEMP TABLE d1 AS
SELECT polla_delete_unpaid_bets('f1000000-0000-0000-0000-0000000014a1', (SELECT id FROM ed),
  'f1000000-0000-0000-0000-0000000014f1', 'f1000000-0000-0000-0000-0000000014c1') AS d;
SELECT is((SELECT (d->>'deleted')::INT FROM d1), 1, 'con pasador y jugador borra solo lo de ese jugador');
SELECT ok(pg_temp.deleted('c1_jugador') AND NOT pg_temp.deleted('c1_propio'), 'lo propio del pasador queda');
SELECT is(
  (SELECT deleted_by FROM polla_bets WHERE polla_bet_id = (SELECT id FROM t WHERE name = 'c1_jugador')),
  'f1000000-0000-0000-0000-0000000014a1'::UUID,
  'queda registrado quién borró'
);

-- -------------------------------------------- superadmin+ en toda la org

CREATE TEMP TABLE d2 AS
SELECT polla_delete_unpaid_bets('f1000000-0000-0000-0000-0000000014a2', (SELECT id FROM ed), NULL,
  'f1000000-0000-0000-0000-0000000014c2') AS d;
SELECT is((SELECT (d->>'deleted')::INT FROM d2), 1, 'el superadmin borra lo del pasador dos');
SELECT is(
  (SELECT deducted_on FROM polla_bets WHERE polla_bet_id = (SELECT id FROM t WHERE name = 'c2')),
  polla_today() + 1,
  'pasador liquidado hoy: la baja va a mañana'
);

CREATE TEMP TABLE s3 AS
SELECT polla_unpaid_bets_summary('f1000000-0000-0000-0000-0000000014a3', (SELECT id FROM ed),
  'f1000000-0000-0000-0000-0000000014f3') AS s;
SELECT is((SELECT (s->>'count')::INT FROM s3), 1, 'el capitalista ve el impago del jugador del otro grupo');

CREATE TEMP TABLE d3 AS
SELECT polla_delete_unpaid_bets('f1000000-0000-0000-0000-0000000014a4', (SELECT id FROM ed), NULL,
  'f1000000-0000-0000-0000-0000000014c3') AS d;
SELECT is((SELECT (d->>'deleted')::INT FROM d3), 1, 'el dueño borra el impago del pasador tres');
SELECT ok(NOT pg_temp.deleted('c3_pagado'), 'lo pagado no se toca');
SELECT is(
  (SELECT deleted_pass FROM polla_current_accounts
   WHERE polla_user_id = 'f1000000-0000-0000-0000-0000000014c3' AND date = polla_today()),
  100::NUMERIC,
  'la baja entra en Borradas de hoy del pasador tres'
);
SELECT is(
  (SELECT bets_count FROM polla_editions WHERE polla_edition_id = (SELECT id FROM ed)),
  2,
  'la edición descuenta los 3 tickets borrados'
);

-- ------------------------------------------------------------ corte

UPDATE polla_editions
SET load_limit_date = polla_today() - 1, start_date = polla_today()
WHERE polla_edition_id = (SELECT id FROM ed);
SELECT throws_ok(
  $$SELECT polla_delete_unpaid_bets('f1000000-0000-0000-0000-0000000014a4', (SELECT id FROM ed), NULL,
      'f1000000-0000-0000-0000-0000000014c1')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED',
  'pasado el cierre de carga tampoco borra el dueño'
);

SELECT * FROM finish();
ROLLBACK;
