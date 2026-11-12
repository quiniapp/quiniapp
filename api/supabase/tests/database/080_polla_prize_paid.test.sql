-- R20: marcar un premio como pagado. Solo dueño, capitalista y superadmin,
-- solo ganadoras, con quién y cuándo, y sin vuelta atrás.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(9);

INSERT INTO polla_organizations (polla_organization_id, name) VALUES
  ('a2000000-0000-0000-0000-000000000020', 'pgTAP R20'),
  ('a2000000-0000-0000-0000-000000000120', 'pgTAP R20 otra');

INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id) VALUES
  ('a2000000-0000-0000-0000-0000000020d1', 'CAPITALIST', 'Capitalista', 'a2000000-0000-0000-0000-000000000020'),
  ('a2000000-0000-0000-0000-0000000020d2', 'SUPERADMIN', 'Superadmin', 'a2000000-0000-0000-0000-000000000020'),
  ('a2000000-0000-0000-0000-0000000020d3', 'ASSISTANT', 'Súper', 'a2000000-0000-0000-0000-000000000020'),
  ('a2000000-0000-0000-0000-0000000120d1', 'CAPITALIST', 'Otro capitalista', 'a2000000-0000-0000-0000-000000000120');

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, fee, fee_plus)
VALUES ('a2000000-0000-0000-0000-0000000020c1', 'CASHIER', 'Pasador R20', 1,
        'a2000000-0000-0000-0000-000000000020', 0, 0);

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a2000000-0000-0000-0000-0000000020a1', 'a2000000-0000-0000-0000-000000000020', 'Nacional R20');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a2000000-0000-0000-0000-0000000020b1', 'a2000000-0000-0000-0000-000000000020', 'Nocturna R20', '21:00');

INSERT INTO polla_editions (
  polla_edition_id, polla_organization_id, polla_lottery_id, polla_schedule_id,
  start_date, end_date, load_limit_date, load_limit_time, pool_amount, ticket_price
) VALUES (
  'a2000000-0000-0000-0000-0000000020e1', 'a2000000-0000-0000-0000-000000000020',
  'a2000000-0000-0000-0000-0000000020a1', 'a2000000-0000-0000-0000-0000000020b1',
  '2030-01-01', '2030-01-06', '2029-12-31', '20:00', 1000, 100
);

INSERT INTO polla_bets (
  polla_bet_id, ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id,
  polla_organization_id, user_name, cashier_name, cashier_number, load_date, amount, numbers,
  winner, prize, hit_date
) VALUES
  ('a2000000-0000-0000-0000-000000020f01', 'R20-1', 'a2000000-0000-0000-0000-0000000020e1',
   'a2000000-0000-0000-0000-0000000020c1', 'a2000000-0000-0000-0000-0000000020c1',
   'a2000000-0000-0000-0000-000000000020', 'Pasador R20', 'Pasador R20', 1, '2029-12-30', 100,
   ARRAY['01','02','03','04','05','06','07','08','09','10'], TRUE, 1000, '2030-01-03'),
  ('a2000000-0000-0000-0000-000000020f02', 'R20-2', 'a2000000-0000-0000-0000-0000000020e1',
   'a2000000-0000-0000-0000-0000000020c1', 'a2000000-0000-0000-0000-0000000020c1',
   'a2000000-0000-0000-0000-000000000020', 'Pasador R20', 'Pasador R20', 1, '2029-12-30', 100,
   ARRAY['11','12','13','14','15','16','17','18','19','20'], FALSE, 0, NULL);

SELECT throws_ok(
  $$SELECT polla_mark_prize_paid('a2000000-0000-0000-0000-0000000020d3', 'a2000000-0000-0000-0000-000000020f01')$$,
  'P0001', 'POLLA_PRIZE_PAY_FORBIDDEN',
  'el Súper no marca premios'
);
SELECT throws_ok(
  $$SELECT polla_mark_prize_paid('a2000000-0000-0000-0000-0000000020c1', 'a2000000-0000-0000-0000-000000020f01')$$,
  'P0001', 'POLLA_PRIZE_PAY_FORBIDDEN',
  'el pasador tampoco'
);
SELECT throws_ok(
  $$SELECT polla_mark_prize_paid('a2000000-0000-0000-0000-0000000120d1', 'a2000000-0000-0000-0000-000000020f01')$$,
  'P0001', 'POLLA_BET_NOT_FOUND',
  'ni el capitalista de otra organización'
);
SELECT throws_ok(
  $$SELECT polla_mark_prize_paid('a2000000-0000-0000-0000-0000000020d1', 'a2000000-0000-0000-0000-000000020f02')$$,
  'P0001', 'POLLA_PRIZE_NOT_WINNER',
  'un ticket que no ganó no tiene premio para pagar'
);

SELECT lives_ok(
  $$SELECT polla_mark_prize_paid('a2000000-0000-0000-0000-0000000020d1', 'a2000000-0000-0000-0000-000000020f01')$$,
  'el capitalista marca el premio como pagado'
);
SELECT is(
  (SELECT prize_paid_by FROM polla_bets WHERE polla_bet_id = 'a2000000-0000-0000-0000-000000020f01'),
  'a2000000-0000-0000-0000-0000000020d1'::UUID,
  'queda quién lo pagó'
);
SELECT ok(
  (SELECT prize_paid_at IS NOT NULL FROM polla_bets WHERE polla_bet_id = 'a2000000-0000-0000-0000-000000020f01'),
  'y cuándo'
);
SELECT throws_ok(
  $$SELECT polla_mark_prize_paid('a2000000-0000-0000-0000-0000000020d2', 'a2000000-0000-0000-0000-000000020f01')$$,
  'P0001', 'POLLA_PRIZE_ALREADY_PAID',
  'una vez pagado no se vuelve a marcar'
);
SELECT is(
  (SELECT prize_paid_by FROM polla_bets WHERE polla_bet_id = 'a2000000-0000-0000-0000-000000020f01'),
  'a2000000-0000-0000-0000-0000000020d1'::UUID,
  'y conserva quién lo pagó'
);

SELECT * FROM finish();
ROLLBACK;
