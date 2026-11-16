-- Pasador deshabilitado (20261115194736): sus jugadores quedan frenados. Nadie
-- les carga (ni ellos, ni el staff, ni repitiendo) hasta que se habilite al
-- pasador, sin marcarlos a ellos. `polla_revoke_player_sessions` cierra las
-- sesiones de sus jugadores.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(12);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a7000000-0000-0000-0000-000000000200', 'pgTAP pasador deshabilitado');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number)
VALUES ('a7000000-0000-0000-0000-0000000200e1', 'a7000000-0000-0000-0000-000000000200', 'Grupo 200', 1);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus) VALUES
  ('a7000000-0000-0000-0000-0000000200c1', 'CASHIER', 'Pasador 200', 1,
   'a7000000-0000-0000-0000-000000000200', 'a7000000-0000-0000-0000-0000000200e1', 10, 0),
  ('a7000000-0000-0000-0000-0000000200c2', 'CASHIER', 'Otro pasador 200', 2,
   'a7000000-0000-0000-0000-000000000200', 'a7000000-0000-0000-0000-0000000200e1', 10, 0);
INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, parent_polla_user_id) VALUES
  ('a7000000-0000-0000-0000-0000000200d1', 'PLAYER', 'Jugador 200 A', 1,
   'a7000000-0000-0000-0000-000000000200', 'a7000000-0000-0000-0000-0000000200e1', 'a7000000-0000-0000-0000-0000000200c1'),
  ('a7000000-0000-0000-0000-0000000200d2', 'PLAYER', 'Jugador 200 B', 2,
   'a7000000-0000-0000-0000-000000000200', 'a7000000-0000-0000-0000-0000000200e1', 'a7000000-0000-0000-0000-0000000200c1'),
  ('a7000000-0000-0000-0000-0000000200d3', 'PLAYER', 'Jugador del otro 200', 1,
   'a7000000-0000-0000-0000-000000000200', 'a7000000-0000-0000-0000-0000000200e1', 'a7000000-0000-0000-0000-0000000200c2');
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a7000000-0000-0000-0000-0000000200a4', 'OWNER', 'Dueño 200', 'a7000000-0000-0000-0000-000000000200');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a7000000-0000-0000-0000-0000000200b1', 'a7000000-0000-0000-0000-000000000200', 'Nacional 200');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a7000000-0000-0000-0000-0000000200b2', 'a7000000-0000-0000-0000-000000000200', 'Nocturna 200', '21:00');

-- Carga abierta: abrió hace 3 días y cierra mañana a las 20.
CREATE TEMP TABLE ed AS
SELECT (polla_create_edition(
  'a7000000-0000-0000-0000-000000000200',
  jsonb_build_object(
    'start_date', polla_today() + 1, 'end_date', polla_today() + 5,
    'load_start_date', polla_today() - 3, 'load_start_time', '09:00',
    'load_limit_date', polla_today() + 1, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ),
  jsonb_build_array(jsonb_build_object(
    'polla_lottery_id', 'a7000000-0000-0000-0000-0000000200b1',
    'polla_schedule_id', 'a7000000-0000-0000-0000-0000000200b2'))
)->>'polla_edition_id')::UUID AS id;

CREATE FUNCTION pg_temp.bet(p_actor UUID, p_target UUID) RETURNS UUID
LANGUAGE sql AS $$
  SELECT (polla_create_bet(
    (SELECT id FROM ed), p_actor, p_target,
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    NULL, FALSE, FALSE, NULL, 'cliente', 'PAID'
  )->'bet'->>'polla_bet_id')::UUID;
$$;

CREATE FUNCTION pg_temp.set_cashier_disabled(p_disabled BOOLEAN) RETURNS VOID
LANGUAGE sql AS $$
  UPDATE polla_users SET disabled = p_disabled
  WHERE polla_user_id = 'a7000000-0000-0000-0000-0000000200c1';
$$;

-- ------------------------------------------------ con el pasador habilitado

CREATE TEMP TABLE t AS
SELECT pg_temp.bet('a7000000-0000-0000-0000-0000000200a4', 'a7000000-0000-0000-0000-0000000200d1') AS src;

SELECT isnt((SELECT src FROM t), NULL, 'con el pasador habilitado el staff le carga al jugador');

-- ---------------------------------------------- con el pasador deshabilitado

SELECT pg_temp.set_cashier_disabled(TRUE);

SELECT throws_ok(
  $$SELECT pg_temp.bet('a7000000-0000-0000-0000-0000000200d1', 'a7000000-0000-0000-0000-0000000200d1')$$,
  'P0001', 'POLLA_CASHIER_DISABLED', 'el jugador no carga');
SELECT throws_ok(
  $$SELECT pg_temp.bet('a7000000-0000-0000-0000-0000000200a4', 'a7000000-0000-0000-0000-0000000200d1')$$,
  'P0001', 'POLLA_CASHIER_DISABLED', 'el staff tampoco le carga');
SELECT throws_ok(
  $$SELECT pg_temp.bet('a7000000-0000-0000-0000-0000000200a4', 'a7000000-0000-0000-0000-0000000200c1')$$,
  'P0001', 'POLLA_USER_NOT_FOUND', 'ni al pasador (como hasta ahora)');
SELECT is(
  polla_repeat_bets('a7000000-0000-0000-0000-0000000200a4', (SELECT id FROM ed), ARRAY[(SELECT src FROM t)],
    FALSE, 'PAID')->'skipped'->0->>'reason',
  'POLLA_CASHIER_DISABLED',
  'repetir su ticket queda en "No se repitieron"');
SELECT lives_ok(
  $$SELECT pg_temp.bet('a7000000-0000-0000-0000-0000000200a4', 'a7000000-0000-0000-0000-0000000200d3')$$,
  'al jugador de otro pasador se le sigue cargando');
SELECT is(
  (SELECT disabled FROM polla_users WHERE polla_user_id = 'a7000000-0000-0000-0000-0000000200d1'),
  FALSE, 'el jugador no queda marcado');

-- ------------------------------------------------ se vuelve a habilitar

SELECT pg_temp.set_cashier_disabled(FALSE);

SELECT lives_ok(
  $$SELECT pg_temp.bet('a7000000-0000-0000-0000-0000000200d1', 'a7000000-0000-0000-0000-0000000200d1')$$,
  'al habilitar al pasador, el jugador vuelve a cargar solo');

-- ------------------------------------------------------------ sesiones

INSERT INTO polla_sessions (polla_session_id, polla_user_id, polla_organization_id, expires_at) VALUES
  ('a7000000-0000-0000-0000-0000000200f1', 'a7000000-0000-0000-0000-0000000200d1', 'a7000000-0000-0000-0000-000000000200', NOW() + INTERVAL '1 hour'),
  ('a7000000-0000-0000-0000-0000000200f2', 'a7000000-0000-0000-0000-0000000200d2', 'a7000000-0000-0000-0000-000000000200', NOW() + INTERVAL '1 hour'),
  ('a7000000-0000-0000-0000-0000000200f3', 'a7000000-0000-0000-0000-0000000200c1', 'a7000000-0000-0000-0000-000000000200', NOW() + INTERVAL '1 hour'),
  ('a7000000-0000-0000-0000-0000000200f4', 'a7000000-0000-0000-0000-0000000200d3', 'a7000000-0000-0000-0000-000000000200', NOW() + INTERVAL '1 hour');

SELECT is(polla_revoke_player_sessions('a7000000-0000-0000-0000-0000000200c1'), 2,
  'cierra las sesiones de sus dos jugadores');
SELECT is(
  (SELECT count(*) FROM polla_sessions
   WHERE polla_session_id IN ('a7000000-0000-0000-0000-0000000200f1', 'a7000000-0000-0000-0000-0000000200f2')
     AND NOT is_active AND revoked_at IS NOT NULL),
  2::BIGINT, 'quedan inactivas y con la hora del cierre');
SELECT is(
  (SELECT is_active FROM polla_sessions WHERE polla_session_id = 'a7000000-0000-0000-0000-0000000200f3'),
  TRUE, 'la del pasador no la toca (la cierra la API con las suyas)');
SELECT is(
  (SELECT is_active FROM polla_sessions WHERE polla_session_id = 'a7000000-0000-0000-0000-0000000200f4'),
  TRUE, 'ni las de jugadores de otro pasador');

SELECT * FROM finish();
ROLLBACK;
