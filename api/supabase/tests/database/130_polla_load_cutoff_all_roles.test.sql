-- R30: el cierre de carga rige para todos los roles. Dueño, capitalista,
-- superadmin, Súper, pasador y jugador cargan hasta el cierre; el admin de
-- grupo, hasta la hora del sorteo; con el sorteo en curso, nadie. Editar
-- números, cada uno hasta su corte; borrar, superadmin+ siempre.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(19);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a6000000-0000-0000-0000-000000000030', 'pgTAP cierre R30');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number)
VALUES ('a6000000-0000-0000-0000-0000000030e1', 'a6000000-0000-0000-0000-000000000030', 'Grupo R30', 1);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
VALUES ('a6000000-0000-0000-0000-0000000030c1', 'CASHIER', 'Pasador R30', 1,
        'a6000000-0000-0000-0000-000000000030', 'a6000000-0000-0000-0000-0000000030e1', 0, 0);
INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, parent_polla_user_id)
VALUES ('a6000000-0000-0000-0000-0000000030f1', 'PLAYER', 'Jugador R30', 1,
        'a6000000-0000-0000-0000-000000000030', 'a6000000-0000-0000-0000-0000000030e1',
        'a6000000-0000-0000-0000-0000000030c1');
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id, polla_group_id) VALUES
  ('a6000000-0000-0000-0000-0000000030a1', 'ADMIN', 'Admin R30',
   'a6000000-0000-0000-0000-000000000030', 'a6000000-0000-0000-0000-0000000030e1'),
  ('a6000000-0000-0000-0000-0000000030a2', 'SUPERADMIN', 'Superadmin R30', 'a6000000-0000-0000-0000-000000000030', NULL),
  ('a6000000-0000-0000-0000-0000000030a3', 'CAPITALIST', 'Capitalista R30', 'a6000000-0000-0000-0000-000000000030', NULL),
  ('a6000000-0000-0000-0000-0000000030a4', 'OWNER', 'Dueño R30', 'a6000000-0000-0000-0000-000000000030', NULL),
  ('a6000000-0000-0000-0000-0000000030a5', 'ASSISTANT', 'Súper R30', 'a6000000-0000-0000-0000-000000000030', NULL);

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a6000000-0000-0000-0000-0000000030b1', 'a6000000-0000-0000-0000-000000000030', 'Nacional R30');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a6000000-0000-0000-0000-0000000030b2', 'a6000000-0000-0000-0000-000000000030', 'Nocturna R30', '21:00');

-- Sorteo mañana a las 21; la carga abre hace 3 días y por ahora cierra mañana a las 20.
CREATE TEMP TABLE ed AS
SELECT (polla_create_edition(
  'a6000000-0000-0000-0000-000000000030',
  jsonb_build_object(
    'start_date', polla_today() + 1, 'end_date', polla_today() + 5,
    'load_start_date', polla_today() - 3, 'load_start_time', '09:00',
    'load_limit_date', polla_today() + 1, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ),
  jsonb_build_array(jsonb_build_object(
    'polla_lottery_id', 'a6000000-0000-0000-0000-0000000030b1',
    'polla_schedule_id', 'a6000000-0000-0000-0000-0000000030b2'))
)->>'polla_edition_id')::UUID AS id;

CREATE FUNCTION pg_temp.bet(p_actor UUID, p_target UUID DEFAULT 'a6000000-0000-0000-0000-0000000030c1') RETURNS UUID
LANGUAGE sql AS $$
  SELECT (polla_create_bet(
    (SELECT id FROM ed), p_actor, p_target,
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    NULL, FALSE, FALSE, NULL, 'cliente', 'PAID'
  )->'bet'->>'polla_bet_id')::UUID;
$$;

-- Tickets cargados con la carga abierta.
CREATE TEMP TABLE t AS
SELECT pg_temp.bet('a6000000-0000-0000-0000-0000000030c1') AS editar,
       pg_temp.bet('a6000000-0000-0000-0000-0000000030c1') AS borrar_super,
       pg_temp.bet('a6000000-0000-0000-0000-0000000030c1') AS borrar_admin,
       pg_temp.bet('a6000000-0000-0000-0000-0000000030c1') AS borrar_super2;

-- Cerró la carga ayer a las 20; el sorteo sigue siendo mañana a las 21.
UPDATE polla_editions SET load_limit_date = polla_today() - 1 WHERE polla_edition_id = (SELECT id FROM ed);

-- ------------------------------------------- pasado el cierre: cargar

SELECT throws_ok($$SELECT pg_temp.bet('a6000000-0000-0000-0000-0000000030a4')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'el dueño no carga después del cierre');
SELECT throws_ok($$SELECT pg_temp.bet('a6000000-0000-0000-0000-0000000030a3')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'el capitalista tampoco');
SELECT throws_ok($$SELECT pg_temp.bet('a6000000-0000-0000-0000-0000000030a2')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'el superadmin tampoco');
SELECT throws_ok($$SELECT pg_temp.bet('a6000000-0000-0000-0000-0000000030a5')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'el Súper tampoco');
SELECT throws_ok($$SELECT pg_temp.bet('a6000000-0000-0000-0000-0000000030c1')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'el pasador tampoco');
SELECT throws_ok(
  $$SELECT pg_temp.bet('a6000000-0000-0000-0000-0000000030f1', 'a6000000-0000-0000-0000-0000000030f1')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'el jugador tampoco');
SELECT lives_ok($$SELECT pg_temp.bet('a6000000-0000-0000-0000-0000000030a1')$$,
  'el admin de grupo carga hasta la hora del sorteo');
SELECT throws_ok(
  $$SELECT polla_repeat_bets('a6000000-0000-0000-0000-0000000030a2', (SELECT id FROM ed),
      ARRAY[(SELECT editar FROM t)], FALSE, 'PAID')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'el superadmin tampoco repite después del cierre');

SELECT is(
  (SELECT load_cutoff FROM polla_editions_load_state(ARRAY[(SELECT id FROM ed)], 'ADMIN')),
  (polla_today() + 1) + '21:00'::TIME,
  'el corte del admin es la hora del sorteo'
);
SELECT is(
  (SELECT load_cutoff FROM polla_editions_load_state(ARRAY[(SELECT id FROM ed)], 'OWNER')),
  (polla_today() - 1) + '20:00'::TIME,
  'el del dueño, el cierre de carga'
);

-- ---------------------------------------- pasado el cierre: editar y borrar

SELECT throws_ok(
  $$SELECT polla_update_bet_numbers((SELECT editar FROM t),
      ARRAY['11','12','13','14','15','16','17','18','19','20'], 'a6000000-0000-0000-0000-0000000030a2')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'el superadmin no edita números después del cierre');
SELECT throws_ok(
  $$SELECT polla_update_bet_numbers((SELECT editar FROM t),
      ARRAY['11','12','13','14','15','16','17','18','19','20'], 'a6000000-0000-0000-0000-0000000030a5')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'el Súper tampoco');
SELECT lives_ok(
  $$SELECT polla_update_bet_numbers((SELECT editar FROM t),
      ARRAY['11','12','13','14','15','16','17','18','19','20'], 'a6000000-0000-0000-0000-0000000030a1')$$,
  'el admin edita hasta la hora del sorteo');
SELECT lives_ok(
  $$SELECT polla_delete_bet((SELECT borrar_super FROM t), 'a6000000-0000-0000-0000-0000000030a2')$$,
  'el superadmin borra para corregir');
SELECT lives_ok(
  $$SELECT polla_delete_bet((SELECT borrar_admin FROM t), 'a6000000-0000-0000-0000-0000000030a1')$$,
  'el admin borra hasta la hora del sorteo');

-- ------------------------------------------------ con el sorteo en curso

-- El sorteo empezó ayer: nadie carga, aunque el cierre esté mal configurado.
UPDATE polla_editions
SET load_start_date = polla_today() - 5, load_limit_date = polla_today() - 3, start_date = polla_today() - 1
WHERE polla_edition_id = (SELECT id FROM ed);

SELECT throws_ok($$SELECT pg_temp.bet('a6000000-0000-0000-0000-0000000030a1')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'con el sorteo en curso el admin ya no carga');
SELECT throws_ok($$SELECT pg_temp.bet('a6000000-0000-0000-0000-0000000030a4')$$,
  'P0001', 'POLLA_LOAD_LIMIT_EXCEEDED', 'ni el dueño (antes cargaba hasta el último día)');
SELECT is(
  (SELECT can_load FROM polla_editions_load_state(ARRAY[(SELECT id FROM ed)], 'SUPERADMIN')),
  FALSE,
  'y Cargar jugada no se la ofrece al superadmin'
);
SELECT lives_ok(
  $$SELECT polla_delete_bet((SELECT borrar_super2 FROM t), 'a6000000-0000-0000-0000-0000000030a4')$$,
  'el dueño sigue pudiendo borrar para corregir');

SELECT * FROM finish();
ROLLBACK;
