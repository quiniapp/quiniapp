-- Ajuste de R30 (20261115124454): dueño, capitalista y superadmin cargan
-- hasta la hora del sorteo, pero repetir (con cargo y de cortesía) les corta
-- en el cierre de carga; el Súper carga y repite hasta el sorteo. Las
-- ediciones para cargar dicen si el rol todavía puede repetir (`can_repeat`),
-- y la liquidación por edición se sigue habilitando desde el cierre de carga.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(19);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a7000000-0000-0000-0000-000000000190', 'pgTAP staff hasta el sorteo');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number)
VALUES ('a7000000-0000-0000-0000-0000000190e1', 'a7000000-0000-0000-0000-000000000190', 'Grupo 190', 1);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
VALUES ('a7000000-0000-0000-0000-0000000190c1', 'CASHIER', 'Pasador 190', 1,
        'a7000000-0000-0000-0000-000000000190', 'a7000000-0000-0000-0000-0000000190e1', 10, 0);
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id, polla_group_id) VALUES
  ('a7000000-0000-0000-0000-0000000190a1', 'ADMIN', 'Admin 190',
   'a7000000-0000-0000-0000-000000000190', 'a7000000-0000-0000-0000-0000000190e1'),
  ('a7000000-0000-0000-0000-0000000190a3', 'CAPITALIST', 'Capitalista 190', 'a7000000-0000-0000-0000-000000000190', NULL),
  ('a7000000-0000-0000-0000-0000000190a4', 'OWNER', 'Dueño 190', 'a7000000-0000-0000-0000-000000000190', NULL),
  ('a7000000-0000-0000-0000-0000000190a5', 'ASSISTANT', 'Súper 190', 'a7000000-0000-0000-0000-000000000190', NULL);

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a7000000-0000-0000-0000-0000000190b1', 'a7000000-0000-0000-0000-000000000190', 'Nacional 190');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a7000000-0000-0000-0000-0000000190b2', 'a7000000-0000-0000-0000-000000000190', 'Nocturna 190', '21:00');

-- Sorteo mañana a las 21; la carga abre hace 3 días y por ahora cierra mañana a las 20.
CREATE TEMP TABLE ed AS
SELECT (polla_create_edition(
  'a7000000-0000-0000-0000-000000000190',
  jsonb_build_object(
    'start_date', polla_today() + 1, 'end_date', polla_today() + 5,
    'load_start_date', polla_today() - 3, 'load_start_time', '09:00',
    'load_limit_date', polla_today() + 1, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ),
  jsonb_build_array(jsonb_build_object(
    'polla_lottery_id', 'a7000000-0000-0000-0000-0000000190b1',
    'polla_schedule_id', 'a7000000-0000-0000-0000-0000000190b2'))
)->>'polla_edition_id')::UUID AS id;

CREATE FUNCTION pg_temp.bet(p_actor UUID) RETURNS UUID
LANGUAGE sql AS $$
  SELECT (polla_create_bet(
    (SELECT id FROM ed), p_actor, 'a7000000-0000-0000-0000-0000000190c1',
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    NULL, FALSE, FALSE, NULL, 'cliente', 'PAID'
  )->'bet'->>'polla_bet_id')::UUID;
$$;

-- El ticket que se repite, cargado por el pasador con la carga abierta.
CREATE TEMP TABLE t AS SELECT pg_temp.bet('a7000000-0000-0000-0000-0000000190c1') AS src;

-- La edición tal como la ve Cargar jugada para el rol (NULL si no aparece).
CREATE FUNCTION pg_temp.loadable(p_role polla_user_type_enum) RETURNS JSONB
LANGUAGE sql AS $$
  SELECT j FROM polla_loadable_editions('a7000000-0000-0000-0000-000000000190', p_role) j
  WHERE (j->>'polla_edition_id')::UUID = (SELECT id FROM ed);
$$;

CREATE FUNCTION pg_temp.repeat(p_actor UUID, p_free BOOLEAN) RETURNS JSONB
LANGUAGE sql AS $$
  SELECT polla_repeat_bets(p_actor, (SELECT id FROM ed), ARRAY[(SELECT src FROM t)], p_free,
    CASE WHEN p_free THEN NULL ELSE 'PAID'::polla_payment_status_enum END);
$$;

CREATE FUNCTION pg_temp.listed() RETURNS BIGINT
LANGUAGE sql AS $$
  SELECT count(*) FROM polla_edition_account_list('a7000000-0000-0000-0000-000000000190') j
  WHERE (j->>'polla_edition_id')::UUID = (SELECT id FROM ed);
$$;

-- ------------------------------------------------ con la carga abierta

SELECT is((pg_temp.loadable('OWNER')->>'can_repeat')::BOOLEAN, TRUE,
  'con la carga abierta se puede repetir');
SELECT is(jsonb_array_length(pg_temp.repeat('a7000000-0000-0000-0000-0000000190a4', FALSE)->'created'), 1,
  'el dueño repite antes del cierre');
SELECT throws_ok(
  $$SELECT polla_liquidate_edition_accounts('a7000000-0000-0000-0000-000000000190', (SELECT id FROM ed),
      ARRAY['a7000000-0000-0000-0000-0000000190c1'::UUID], 'a7000000-0000-0000-0000-0000000190a4')$$,
  'P0001', 'POLLA_EDITION_LOAD_OPEN', 'antes del cierre no se liquida');
SELECT is(pg_temp.listed(), 0::BIGINT, 'ni aparece en Pollas a liquidar');

-- ---------------------------------- pasado el cierre, antes del sorteo

-- Cerró la carga ayer a las 20; el sorteo sigue siendo mañana a las 21.
UPDATE polla_editions SET load_limit_date = polla_today() - 1 WHERE polla_edition_id = (SELECT id FROM ed);

SELECT is((pg_temp.loadable('OWNER')->>'can_repeat')::BOOLEAN, FALSE,
  'el dueño sigue viendo la edición en Cargar jugada, pero sin repetir');
SELECT is((pg_temp.loadable('OWNER')->>'my_load_cutoff')::TIMESTAMP, (polla_today() + 1) + '21:00'::TIME,
  'y carga hasta la hora del sorteo');
SELECT is((pg_temp.loadable('SUPERADMIN')->>'can_repeat')::BOOLEAN, FALSE,
  'lo mismo el superadmin');
SELECT is(pg_temp.loadable('ADMIN'), NULL::JSONB, 'el admin de grupo ya no la ve');
SELECT is(pg_temp.loadable('CASHIER'), NULL::JSONB, 'ni el pasador');
SELECT throws_ok($$SELECT pg_temp.repeat('a7000000-0000-0000-0000-0000000190a4', FALSE)$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'el dueño no repite con cargo después del cierre');
SELECT throws_ok($$SELECT pg_temp.repeat('a7000000-0000-0000-0000-0000000190a3', FALSE)$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'el capitalista tampoco');
SELECT throws_ok($$SELECT pg_temp.repeat('a7000000-0000-0000-0000-0000000190a4', TRUE)$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'ni de cortesía');
SELECT lives_ok($$SELECT pg_temp.bet('a7000000-0000-0000-0000-0000000190a4')$$,
  'pero el dueño sí carga una jugada nueva');
SELECT is((pg_temp.loadable('ASSISTANT')->>'can_repeat')::BOOLEAN, TRUE,
  'el Súper sigue pudiendo repetir');
SELECT is(jsonb_array_length(pg_temp.repeat('a7000000-0000-0000-0000-0000000190a5', FALSE)->'created'), 1,
  'y repite con cargo después del cierre, hasta la hora del sorteo');
SELECT is(pg_temp.listed(), 1::BIGINT, 'desde el cierre aparece en Pollas a liquidar');
SELECT is(
  polla_liquidate_edition_accounts('a7000000-0000-0000-0000-000000000190', (SELECT id FROM ed),
    ARRAY['a7000000-0000-0000-0000-0000000190c1'::UUID], 'a7000000-0000-0000-0000-0000000190a4')->>'status',
  'LIQUIDATED',
  'y se liquida aunque el staff todavía pueda cargar');

-- ------------------------------------------------ con el sorteo en curso

UPDATE polla_editions
SET load_start_date = polla_today() - 5, load_limit_date = polla_today() - 3, start_date = polla_today() - 1
WHERE polla_edition_id = (SELECT id FROM ed);

SELECT is(pg_temp.loadable('OWNER'), NULL::JSONB, 'con el sorteo en curso el dueño ya no la ve');
SELECT throws_ok($$SELECT pg_temp.bet('a7000000-0000-0000-0000-0000000190a4')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'ni carga');

SELECT * FROM finish();
ROLLBACK;
