-- R04: cerrar el ticket con Efectivo o Debe. El jugador carga siempre en Debe;
-- lo repetido sin cargo queda pagado; el pago se elige para todo el lote al
-- repetir. Una jugada en Debe entra al pase igual que una pagada.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('d0000000-0000-0000-0000-000000000004', 'pgTAP pago');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number)
VALUES ('d0000000-0000-0000-0000-0000000004e1', 'd0000000-0000-0000-0000-000000000004', 'Grupo pago', 1);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
VALUES ('d0000000-0000-0000-0000-0000000004c1', 'CASHIER', 'Pasador pago', 1,
        'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-0000000004e1', 0, 0);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, parent_polla_user_id)
VALUES ('d0000000-0000-0000-0000-0000000004f1', 'PLAYER', 'Jugador pago', 1,
        'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-0000000004e1',
        'd0000000-0000-0000-0000-0000000004c1');

INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id, polla_group_id) VALUES
  ('d0000000-0000-0000-0000-0000000004a1', 'ADMIN', 'Admin pago',
   'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-0000000004e1');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('d0000000-0000-0000-0000-0000000004b1', 'd0000000-0000-0000-0000-000000000004', 'Nacional pago');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('d0000000-0000-0000-0000-0000000004b2', 'd0000000-0000-0000-0000-000000000004', 'Nocturna pago', '21:00');

CREATE TEMP TABLE ed AS
SELECT (polla_create_edition(
  'd0000000-0000-0000-0000-000000000004',
  jsonb_build_object(
    'start_date', polla_today() + 10, 'end_date', polla_today() + 15,
    'load_limit_date', polla_today() + 9, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ),
  jsonb_build_array(jsonb_build_object(
    'polla_lottery_id', 'd0000000-0000-0000-0000-0000000004b1',
    'polla_schedule_id', 'd0000000-0000-0000-0000-0000000004b2'))
)->>'polla_edition_id')::UUID AS id;

CREATE FUNCTION pg_temp.bet(
  p_actor UUID, p_target UUID, p_identifier TEXT, p_payment polla_payment_status_enum
) RETURNS polla_bets LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
  v_bet polla_bets;
BEGIN
  v_id := (polla_create_bet(
    (SELECT id FROM ed), p_actor, p_target,
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    NULL, FALSE, FALSE, NULL, p_identifier, p_payment
  )->'bet'->>'polla_bet_id')::UUID;
  SELECT * INTO v_bet FROM polla_bets WHERE polla_bet_id = v_id;
  RETURN v_bet;
END;
$$;

-- --------------------------------------------- lo que ya existía

SELECT is(
  (SELECT column_default FROM information_schema.columns
   WHERE table_name = 'polla_bets' AND column_name = 'payment_status'),
  '''PAID''::polla_payment_status_enum',
  'una jugada sin estado de pago queda pagada (las existentes se migraron así)'
);

-- ------------------------------------------------------- Efectivo

CREATE TEMP TABLE cash AS
SELECT * FROM pg_temp.bet('d0000000-0000-0000-0000-0000000004c1', 'd0000000-0000-0000-0000-0000000004c1', 'chicho', 'PAID');

SELECT is((SELECT payment_status FROM cash), 'PAID'::polla_payment_status_enum, 'Efectivo: queda pagada');
SELECT is((SELECT payment_method FROM cash), 'CASH'::polla_payment_method_enum, 'en efectivo');
SELECT is((SELECT paid_by FROM cash), 'd0000000-0000-0000-0000-0000000004c1'::UUID, 'cobrada por quien la cargó');
SELECT ok((SELECT paid_at IS NOT NULL FROM cash), 'con la hora del cobro');

CREATE TEMP TABLE no_choice AS
SELECT * FROM pg_temp.bet('d0000000-0000-0000-0000-0000000004c1', 'd0000000-0000-0000-0000-0000000004c1', 'chicho', NULL);
SELECT is((SELECT payment_status FROM no_choice), 'PAID'::polla_payment_status_enum, 'sin elegir, Efectivo (como hasta ahora)');

-- ----------------------------------------------------------- Debe

CREATE TEMP TABLE owed AS
SELECT * FROM pg_temp.bet('d0000000-0000-0000-0000-0000000004a1', 'd0000000-0000-0000-0000-0000000004f1', NULL, 'OWED');

SELECT is((SELECT payment_status FROM owed), 'OWED'::polla_payment_status_enum, 'Debe: queda fiada');
SELECT ok(
  (SELECT payment_method IS NULL AND paid_at IS NULL AND paid_by IS NULL FROM owed),
  'en Debe no hay medio ni cobro'
);
SELECT is((SELECT amount FROM owed), 100.00::NUMERIC(12,2), 'y vale lo mismo: entra al pase');
SELECT is(
  (SELECT bets_count FROM polla_editions WHERE polla_edition_id = (SELECT id FROM ed)),
  3,
  'la edición cuenta las fiadas como cualquier jugada'
);

SELECT throws_ok(
  $$UPDATE polla_bets SET paid_at = NOW() WHERE polla_bet_id = (SELECT polla_bet_id FROM owed)$$,
  '23514',
  NULL,
  'una jugada en Debe no puede tener cobro'
);

-- -------------------------------------------- el jugador no elige

CREATE TEMP TABLE by_player AS
SELECT * FROM pg_temp.bet('d0000000-0000-0000-0000-0000000004f1', 'd0000000-0000-0000-0000-0000000004f1', NULL, 'PAID');

SELECT is(
  (SELECT payment_status FROM by_player),
  'OWED'::polla_payment_status_enum,
  'lo que carga el jugador queda siempre en Debe, aunque mande Efectivo'
);

-- --------------------------------------------------------- repetir

CREATE TEMP TABLE repeated AS
SELECT polla_repeat_bets(
  'd0000000-0000-0000-0000-0000000004c1',
  (SELECT id FROM ed),
  ARRAY[(SELECT polla_bet_id FROM cash), (SELECT polla_bet_id FROM owed)],
  FALSE,
  'OWED'
) AS r;

SELECT is((SELECT jsonb_array_length(r->'created') FROM repeated), 2, 'repite el lote');
SELECT is(
  (SELECT array_agg(DISTINCT (x->>'payment_status')) FROM repeated, jsonb_array_elements(r->'created') x),
  ARRAY['OWED'],
  'con el pago elegido para todo el lote'
);

-- Sin cargo: una edición terminada de la que se repite.
UPDATE polla_editions SET status = 'FINISHED' WHERE polla_edition_id = (SELECT id FROM ed);
CREATE TEMP TABLE ed2 AS
SELECT (polla_create_edition(
  'd0000000-0000-0000-0000-000000000004',
  jsonb_build_object(
    'start_date', polla_today() + 20, 'end_date', polla_today() + 25,
    'load_limit_date', polla_today() + 19, 'load_limit_time', '20:00',
    'pool_amount', 1000, 'ticket_price', 100
  ),
  jsonb_build_array(jsonb_build_object(
    'polla_lottery_id', 'd0000000-0000-0000-0000-0000000004b1',
    'polla_schedule_id', 'd0000000-0000-0000-0000-0000000004b2'))
)->>'polla_edition_id')::UUID AS id;

CREATE TEMP TABLE free_repeat AS
SELECT polla_repeat_bets(
  'd0000000-0000-0000-0000-0000000004a1',
  (SELECT id FROM ed2),
  ARRAY[(SELECT polla_bet_id FROM owed)],
  TRUE,
  'OWED'
)->'created'->0 AS b;

SELECT is((SELECT b->>'payment_status' FROM free_repeat), 'PAID', 'lo repetido sin cargo queda pagado');
SELECT is((SELECT b->>'payment_method' FROM free_repeat), NULL, 'sin medio: no hubo cobro');

SELECT is(
  (SELECT COUNT(*)::INT FROM polla_bets
   WHERE polla_organization_id = 'd0000000-0000-0000-0000-000000000004' AND payment_status = 'OWED'),
  4,
  'quedan en Debe la del admin, la del jugador y las dos repetidas'
);

SELECT * FROM finish();
ROLLBACK;
