-- R14: "Eliminar impagos" del pasador: solo lo imputado a él, en la edición;
-- nunca ganadoras; con el corte de carga; y la baja entra en Borradas igual
-- que el borrado de a uno. El staff, en 065.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(16);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('f0000000-0000-0000-0000-000000000014', 'pgTAP impagos');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number)
VALUES ('f0000000-0000-0000-0000-0000000014e1', 'f0000000-0000-0000-0000-000000000014', 'Grupo impagos', 1);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus) VALUES
  ('f0000000-0000-0000-0000-0000000014c1', 'CASHIER', 'Pasador uno', 1,
   'f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-0000000014e1', 0, 0),
  ('f0000000-0000-0000-0000-0000000014c2', 'CASHIER', 'Pasador dos', 2,
   'f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-0000000014e1', 0, 0);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, parent_polla_user_id) VALUES
  ('f0000000-0000-0000-0000-0000000014f1', 'PLAYER', 'Jugador uno', 1,
   'f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-0000000014e1',
   'f0000000-0000-0000-0000-0000000014c1'),
  ('f0000000-0000-0000-0000-0000000014f2', 'PLAYER', 'Jugador dos', 2,
   'f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-0000000014e1',
   'f0000000-0000-0000-0000-0000000014c1');

INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id, polla_group_id)
VALUES ('f0000000-0000-0000-0000-0000000014a1', 'ADMIN', 'Admin impagos',
        'f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-0000000014e1');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('f0000000-0000-0000-0000-0000000014b1', 'f0000000-0000-0000-0000-000000000014', 'Nacional R14');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('f0000000-0000-0000-0000-0000000014b2', 'f0000000-0000-0000-0000-000000000014', 'Nocturna R14', '21:00');

CREATE FUNCTION pg_temp.edition(p_start_offset INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT (polla_create_edition(
    'f0000000-0000-0000-0000-000000000014',
    jsonb_build_object(
      'start_date', polla_today() + p_start_offset, 'end_date', polla_today() + p_start_offset + 5,
      'load_limit_date', polla_today() + p_start_offset - 1, 'load_limit_time', '20:00',
      'pool_amount', 1000, 'ticket_price', 100
    ),
    jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', 'f0000000-0000-0000-0000-0000000014b1',
      'polla_schedule_id', 'f0000000-0000-0000-0000-0000000014b2'))
  )->>'polla_edition_id')::UUID;
$$;

CREATE TEMP TABLE ed AS SELECT pg_temp.edition(10) AS id;
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

-- Del pasador uno: dos impagos del jugador uno, uno del jugador dos, uno
-- pagado y un impago ganador. Del pasador dos: un impago.
SELECT pg_temp.bet('j1a', 'f0000000-0000-0000-0000-0000000014c1', 'f0000000-0000-0000-0000-0000000014f1', NULL, 'OWED');
SELECT pg_temp.bet('j1b', 'f0000000-0000-0000-0000-0000000014c1', 'f0000000-0000-0000-0000-0000000014f1', NULL, 'OWED');
SELECT pg_temp.bet('j2', 'f0000000-0000-0000-0000-0000000014c1', 'f0000000-0000-0000-0000-0000000014f2', NULL, 'OWED');
SELECT pg_temp.bet('pagado', 'f0000000-0000-0000-0000-0000000014c1', 'f0000000-0000-0000-0000-0000000014f1', NULL, 'PAID');
SELECT pg_temp.bet('ganador', 'f0000000-0000-0000-0000-0000000014c1', 'f0000000-0000-0000-0000-0000000014c1', 'chicho', 'OWED');
SELECT pg_temp.bet('otro', 'f0000000-0000-0000-0000-0000000014c2', 'f0000000-0000-0000-0000-0000000014c2', 'beto', 'OWED');
UPDATE polla_bets SET winner = TRUE, prize = 1000 WHERE polla_bet_id = (SELECT id FROM t WHERE name = 'ganador');

-- -------------------------------------------------------------- quién

-- El staff también borra (065), pero tiene que elegir pasador o jugador.
SELECT throws_ok(
  $$SELECT polla_delete_unpaid_bets('f0000000-0000-0000-0000-0000000014a1', (SELECT id FROM ed))$$,
  'P0001', 'POLLA_UNPAID_DELETE_TARGET_REQUIRED',
  'el admin sin elegir pasador ni jugador no borra'
);
SELECT throws_ok(
  $$SELECT polla_unpaid_bets_summary('f0000000-0000-0000-0000-0000000014f1', (SELECT id FROM ed))$$,
  'P0001', 'POLLA_UNPAID_DELETE_FORBIDDEN',
  'el jugador no borra impagos'
);

-- --------------------------------------------------------- resumen

CREATE TEMP TABLE s1 AS
SELECT polla_unpaid_bets_summary('f0000000-0000-0000-0000-0000000014c1', (SELECT id FROM ed)) AS s;

SELECT is((SELECT (s->>'count')::INT FROM s1), 3, 'el resumen cuenta sus 3 impagos que no ganaron');
SELECT is((SELECT (s->>'amount')::NUMERIC FROM s1), 300::NUMERIC, 'y cuánto suman');
SELECT is((SELECT (s->>'winners_skipped')::INT FROM s1), 1, 'avisa que una ganadora en Debe no se borra');
SELECT is((SELECT (s->>'can_delete')::BOOLEAN FROM s1), TRUE, 'con la carga abierta se puede borrar');

-- ------------------------------------------------- de un jugador

CREATE TEMP TABLE d1 AS
SELECT polla_delete_unpaid_bets(
  'f0000000-0000-0000-0000-0000000014c1', (SELECT id FROM ed), 'f0000000-0000-0000-0000-0000000014f1'
) AS d;

SELECT is((SELECT (d->>'deleted')::INT FROM d1), 2, 'borra los 2 impagos del jugador elegido');
SELECT ok(pg_temp.deleted('j1a') AND pg_temp.deleted('j1b'), 'quedan borrados');
SELECT ok(NOT pg_temp.deleted('j2'), 'los del otro jugador no');
SELECT ok(NOT pg_temp.deleted('pagado'), 'lo pagado no');
SELECT is(
  (SELECT deducted_on FROM polla_bets WHERE polla_bet_id = (SELECT id FROM t WHERE name = 'j1a')),
  polla_today(),
  'la baja se descuenta hoy (Borradas)'
);

-- ------------------------------------------------- todos los suyos

CREATE TEMP TABLE d2 AS
SELECT polla_delete_unpaid_bets('f0000000-0000-0000-0000-0000000014c1', (SELECT id FROM ed)) AS d;

SELECT is((SELECT (d->>'deleted')::INT FROM d2), 1, 'después borra el impago que quedaba');
SELECT ok(NOT pg_temp.deleted('ganador'), 'una ganadora nunca se borra');
SELECT ok(NOT pg_temp.deleted('otro'), 'lo de otro pasador no se toca');
SELECT is(
  (SELECT bets_count FROM polla_editions WHERE polla_edition_id = (SELECT id FROM ed)),
  3,
  'la edición descuenta los tickets borrados'
);

-- ------------------------------------------------------------ corte

UPDATE polla_editions
SET load_limit_date = polla_today() - 1, start_date = polla_today()
WHERE polla_edition_id = (SELECT id FROM ed);
SELECT throws_ok(
  $$SELECT polla_delete_unpaid_bets('f0000000-0000-0000-0000-0000000014c2', (SELECT id FROM ed))$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED',
  'pasado el cierre de carga no se borra'
);

SELECT * FROM finish();
ROLLBACK;
