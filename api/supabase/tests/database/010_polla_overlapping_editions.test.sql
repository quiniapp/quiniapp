-- R27: dos ediciones de la misma quiniela y turno pueden solaparse, y un mismo
-- sorteo procesa las dos, cada una con su pozo y sus tickets.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(9);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a0000000-0000-0000-0000-000000000027', 'pgTAP R27');

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, fee, fee_plus)
VALUES ('a0000000-0000-0000-0000-0000000027c1', 'CASHIER', 'Pasador R27', 1,
        'a0000000-0000-0000-0000-000000000027', 0, 0);

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a0000000-0000-0000-0000-0000000027a1', 'a0000000-0000-0000-0000-000000000027', 'Nacional R27');

INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a0000000-0000-0000-0000-0000000027b1', 'a0000000-0000-0000-0000-000000000027', 'Nocturna R27', '21:00');

-- La regular, de lunes a sábado.
INSERT INTO polla_editions (
  polla_edition_id, polla_organization_id, polla_lottery_id, polla_schedule_id,
  start_date, end_date, load_limit_date, load_limit_time, pool_amount, ticket_price
) VALUES (
  'a0000000-0000-0000-0000-0000000027e1', 'a0000000-0000-0000-0000-000000000027',
  'a0000000-0000-0000-0000-0000000027a1', 'a0000000-0000-0000-0000-0000000027b1',
  '2030-03-04', '2030-03-09', '2030-03-04', '20:00', 1000, 100
);

SELECT lives_ok(
  $$INSERT INTO polla_editions (
      polla_edition_id, polla_organization_id, polla_lottery_id, polla_schedule_id,
      start_date, end_date, load_limit_date, load_limit_time, pool_amount, ticket_price
    ) VALUES (
      'a0000000-0000-0000-0000-0000000027e2', 'a0000000-0000-0000-0000-000000000027',
      'a0000000-0000-0000-0000-0000000027a1', 'a0000000-0000-0000-0000-0000000027b1',
      '2030-03-09', '2030-03-09', '2030-03-09', '20:00', 500, 100
    )$$,
  'una edición de la misma quiniela y turno puede solaparse con otra'
);

INSERT INTO polla_bets (
  polla_bet_id, ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id,
  polla_organization_id, user_name, cashier_name, cashier_number, load_date, amount, numbers
) VALUES
  ('a0000000-0000-0000-0000-000000027f01', 'R27-1', 'a0000000-0000-0000-0000-0000000027e1',
   'a0000000-0000-0000-0000-0000000027c1', 'a0000000-0000-0000-0000-0000000027c1',
   'a0000000-0000-0000-0000-000000000027', 'Pasador R27', 'Pasador R27', 1, '2030-03-03', 100,
   ARRAY['01','02','03','04','05','06','07','08','09','10']),
  ('a0000000-0000-0000-0000-000000027f02', 'R27-2', 'a0000000-0000-0000-0000-0000000027e2',
   'a0000000-0000-0000-0000-0000000027c1', 'a0000000-0000-0000-0000-0000000027c1',
   'a0000000-0000-0000-0000-000000000027', 'Pasador R27', 'Pasador R27', 1, '2030-03-08', 100,
   ARRAY['01','02','03','04','05','06','07','08','09','10']),
  ('a0000000-0000-0000-0000-000000027f03', 'R27-3', 'a0000000-0000-0000-0000-0000000027e2',
   'a0000000-0000-0000-0000-0000000027c1', 'a0000000-0000-0000-0000-0000000027c1',
   'a0000000-0000-0000-0000-000000000027', 'Pasador R27', 'Pasador R27', 1, '2030-03-08', 100,
   ARRAY['11','12','13','14','15','16','17','18','90','91']);

INSERT INTO polla_results (polla_organization_id, polla_lottery_id, polla_schedule_id, date, results)
VALUES ('a0000000-0000-0000-0000-000000000027', 'a0000000-0000-0000-0000-0000000027a1',
        'a0000000-0000-0000-0000-0000000027b1', '2030-03-09',
        ARRAY['01','02','03','04','05','06','07','08','09','10',
              '11','12','13','14','15','16','17','18','19','20']);

CREATE TEMP TABLE processed AS
SELECT polla_process_results_and_accounts(
  'a0000000-0000-0000-0000-000000000027',
  'a0000000-0000-0000-0000-0000000027b1',
  '2030-03-09'
) AS r;

SELECT is(
  (SELECT jsonb_array_length(r->'editions') FROM processed),
  2,
  'el sorteo procesa las dos ediciones que lo incluyen'
);

SELECT is(
  (SELECT winner FROM polla_bets WHERE ticket_number = 'R27-1'),
  TRUE,
  'gana el ticket de la regular'
);
SELECT is(
  (SELECT prize FROM polla_bets WHERE ticket_number = 'R27-1'),
  1000.00::NUMERIC(12,2),
  'el de la regular se lleva el pozo de la regular'
);
SELECT is(
  (SELECT winner FROM polla_bets WHERE ticket_number = 'R27-2'),
  TRUE,
  'gana el ticket de la otra edición'
);
SELECT is(
  (SELECT prize FROM polla_bets WHERE ticket_number = 'R27-2'),
  500.00::NUMERIC(12,2),
  'el de la otra edición se lleva su pozo, sin mezclar'
);
SELECT is(
  (SELECT hits FROM polla_bets WHERE ticket_number = 'R27-3'),
  8,
  'los aciertos de cada ticket se cuentan en su edición'
);
SELECT is(
  (SELECT array_agg(status::TEXT ORDER BY polla_edition_id) FROM polla_editions
   WHERE polla_organization_id = 'a0000000-0000-0000-0000-000000000027'),
  ARRAY['FINISHED', 'FINISHED'],
  'las dos ediciones terminan con su ganador'
);
SELECT is(
  (SELECT COUNT(*)::INT FROM polla_bets
   WHERE polla_organization_id = 'a0000000-0000-0000-0000-000000000027' AND winner),
  2,
  'no hay ganadores de más'
);

SELECT * FROM finish();
ROLLBACK;
