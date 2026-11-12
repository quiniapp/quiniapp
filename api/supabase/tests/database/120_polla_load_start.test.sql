-- R29: inicio de carga. Antes del inicio nadie carga ni repite; el inicio va
-- antes del cierre; sin inicio, el alta toma ahora; Cargar jugada solo ofrece
-- las que tienen la carga abierta.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(12);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a5000000-0000-0000-0000-000000000029', 'pgTAP inicio de carga R29');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number)
VALUES ('a5000000-0000-0000-0000-0000000029e1', 'a5000000-0000-0000-0000-000000000029', 'Grupo R29', 1);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
VALUES ('a5000000-0000-0000-0000-0000000029c1', 'CASHIER', 'Pasador R29', 1,
        'a5000000-0000-0000-0000-000000000029', 'a5000000-0000-0000-0000-0000000029e1', 0, 0);
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a5000000-0000-0000-0000-0000000029a1', 'OWNER', 'Dueño R29', 'a5000000-0000-0000-0000-000000000029');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a5000000-0000-0000-0000-0000000029b1', 'a5000000-0000-0000-0000-000000000029', 'Nacional R29');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a5000000-0000-0000-0000-0000000029b2', 'a5000000-0000-0000-0000-000000000029', 'Nocturna R29', '21:00');

CREATE FUNCTION pg_temp.payload(p_extra JSONB DEFAULT '{}') RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'start_date', polla_today() + 10, 'end_date', polla_today() + 15,
    'load_limit_date', polla_today() + 9, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ) || p_extra;
$$;

CREATE FUNCTION pg_temp.draws() RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_build_array(jsonb_build_object(
    'polla_lottery_id', 'a5000000-0000-0000-0000-0000000029b1',
    'polla_schedule_id', 'a5000000-0000-0000-0000-0000000029b2'));
$$;

CREATE FUNCTION pg_temp.bet(p_edition UUID, p_actor UUID) RETURNS JSONB LANGUAGE sql AS $$
  SELECT polla_create_bet(
    p_edition, p_actor, 'a5000000-0000-0000-0000-0000000029c1',
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    NULL, FALSE, FALSE, NULL, 'cliente', 'PAID');
$$;

-- Se crea hoy y abre la carga mañana a las 14.
CREATE TEMP TABLE ed AS
SELECT (polla_create_edition(
  'a5000000-0000-0000-0000-000000000029',
  pg_temp.payload(jsonb_build_object('load_start_date', polla_today() + 1, 'load_start_time', '14:00')),
  pg_temp.draws()
)->>'polla_edition_id')::UUID AS futura,
(polla_create_edition(
  'a5000000-0000-0000-0000-000000000029', pg_temp.payload(), pg_temp.draws()
)->>'polla_edition_id')::UUID AS ahora;

-- ------------------------------------------------------------ antes

SELECT throws_ok(
  $$SELECT pg_temp.bet((SELECT futura FROM ed), 'a5000000-0000-0000-0000-0000000029c1')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED',
  'el pasador no carga antes del inicio de carga'
);
SELECT throws_ok(
  $$SELECT pg_temp.bet((SELECT futura FROM ed), 'a5000000-0000-0000-0000-0000000029a1')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED',
  'el dueño tampoco'
);
SELECT is(
  (SELECT load_started FROM polla_editions_load_state(ARRAY[(SELECT futura FROM ed)], 'CASHIER')),
  FALSE,
  'el estado de carga dice que todavía no abrió'
);
SELECT is(
  (SELECT load_start FROM polla_editions_load_state(ARRAY[(SELECT futura FROM ed)], 'CASHIER')),
  (polla_today() + 1) + '14:00'::TIME,
  'y desde cuándo abre'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM polla_loadable_editions('a5000000-0000-0000-0000-000000000029', 'CASHIER') e
    WHERE (e->>'polla_edition_id')::UUID = (SELECT futura FROM ed)
  ),
  'Cargar jugada no la ofrece todavía'
);

-- --------------------------------------------------- inicio por defecto

SELECT is(
  (SELECT load_start_date FROM polla_editions WHERE polla_edition_id = (SELECT ahora FROM ed)),
  polla_today(),
  'sin inicio de carga, el alta toma hoy'
);
SELECT ok(
  (SELECT polla_load_start(e) <= polla_now() FROM polla_editions e WHERE polla_edition_id = (SELECT ahora FROM ed)),
  'y la hora actual (ya abrió)'
);
SELECT lives_ok(
  $$SELECT pg_temp.bet((SELECT ahora FROM ed), 'a5000000-0000-0000-0000-0000000029c1')$$,
  'con la carga abierta se carga'
);

-- ------------------------------------------------------ abrirla antes

SELECT lives_ok(
  $$SELECT polla_update_edition((SELECT futura FROM ed),
      jsonb_build_object('load_start_date', polla_today() - 1, 'load_start_time', '09:00'))$$,
  'el inicio de carga se puede cambiar'
);
SELECT lives_ok(
  $$SELECT pg_temp.bet((SELECT futura FROM ed), 'a5000000-0000-0000-0000-0000000029c1')$$,
  'y ya abierta se carga'
);

-- ----------------------------------------------------------- validaciones

SELECT throws_ok(
  $$SELECT polla_create_edition('a5000000-0000-0000-0000-000000000029',
      pg_temp.payload(jsonb_build_object('load_start_date', polla_today() + 9, 'load_start_time', '20:00')),
      pg_temp.draws())$$,
  'P0001', 'POLLA_LOAD_START_AFTER_LIMIT',
  'el inicio de carga tiene que ser antes del cierre'
);
SELECT throws_ok(
  $$SELECT polla_update_edition((SELECT ahora FROM ed),
      jsonb_build_object('load_limit_date', polla_today() - 1))$$,
  'P0001', 'POLLA_LOAD_START_AFTER_LIMIT',
  'tampoco se puede mover el cierre antes del inicio'
);

SELECT * FROM finish();
ROLLBACK;
