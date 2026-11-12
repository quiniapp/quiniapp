-- R18: los premios no van en la cuenta corriente desde el período abierto.
-- Lo ya liquidado conserva sus premios aunque se recalcule.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(9);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a1000000-0000-0000-0000-000000000018', 'pgTAP R18');

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, fee, fee_plus) VALUES
  ('a1000000-0000-0000-0000-0000000018c1', 'CASHIER', 'Abierto', 1, 'a1000000-0000-0000-0000-000000000018', 10, 0),
  ('a1000000-0000-0000-0000-0000000018c2', 'CASHIER', 'Liquidado', 2, 'a1000000-0000-0000-0000-000000000018', 10, 0);

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a1000000-0000-0000-0000-0000000018a1', 'a1000000-0000-0000-0000-000000000018', 'Nacional R18');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a1000000-0000-0000-0000-0000000018b1', 'a1000000-0000-0000-0000-000000000018', 'Nocturna R18', '21:00');

INSERT INTO polla_editions (
  polla_edition_id, polla_organization_id, polla_lottery_id, polla_schedule_id,
  start_date, end_date, load_limit_date, load_limit_time, pool_amount, ticket_price
) VALUES (
  'a1000000-0000-0000-0000-0000000018e1', 'a1000000-0000-0000-0000-000000000018',
  'a1000000-0000-0000-0000-0000000018a1', 'a1000000-0000-0000-0000-0000000018b1',
  '2030-01-01', '2030-01-31', '2029-12-31', '20:00', 5000, 100
);

CREATE FUNCTION pg_temp.bet(p_ticket TEXT, p_cashier UUID, p_load DATE, p_prize NUMERIC, p_hit DATE)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO polla_bets (
    ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id, polla_organization_id,
    user_name, cashier_name, cashier_number, load_date, amount, numbers, winner, prize, hit_date
  ) VALUES (
    p_ticket, 'a1000000-0000-0000-0000-0000000018e1', p_cashier, p_cashier,
    'a1000000-0000-0000-0000-000000000018', 'Pasador', 'Pasador', 1, p_load, 100,
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    p_prize > 0, p_prize, p_hit
  );
$$;

CREATE FUNCTION pg_temp.row_of(p_cashier UUID, p_date DATE) RETURNS polla_current_accounts LANGUAGE sql AS $$
  SELECT * FROM polla_current_accounts WHERE polla_user_id = p_cashier AND date = p_date;
$$;

-- ------------------------------------------- período abierto: sin premios

-- Dos tickets el 10 y uno de ellos gana $5.000 el 12.
SELECT pg_temp.bet('R18-1', 'a1000000-0000-0000-0000-0000000018c1', '2030-01-10', 0, NULL);
SELECT pg_temp.bet('R18-2', 'a1000000-0000-0000-0000-0000000018c1', '2030-01-10', 5000, '2030-01-12');

SELECT polla_calculate_current_account('10-01-2030', FALSE, FALSE, 'a1000000-0000-0000-0000-000000000018');
SELECT polla_calculate_current_account('12-01-2030', FALSE, FALSE, 'a1000000-0000-0000-0000-000000000018');

SELECT is((pg_temp.row_of('a1000000-0000-0000-0000-0000000018c1', '2030-01-10')).subtotal,
          180.00::NUMERIC(12,2), 'el pase menos la comisión sigue igual');
SELECT is((pg_temp.row_of('a1000000-0000-0000-0000-0000000018c1', '2030-01-12')).successes,
          0.00::NUMERIC(12,2), 'el premio del día no figura en la cuenta');
SELECT is((pg_temp.row_of('a1000000-0000-0000-0000-0000000018c1', '2030-01-12')).subtotal,
          0.00::NUMERIC(12,2), 'ni resta en el subtotal');

-- La cascada encadena el saldo: el total del 12 es el del 10, sin el premio.
SELECT polla_cascade_current_account_from_date('10-01-2030', 'a1000000-0000-0000-0000-000000000018');
SELECT is((pg_temp.row_of('a1000000-0000-0000-0000-0000000018c1', '2030-01-12')).total,
          180.00::NUMERIC(12,2), 'ni en el saldo');

-- Editar el día (cobros, reclamos) tampoco lo vuelve a sumar.
SELECT polla_update_current_account_recompute(
  (pg_temp.row_of('a1000000-0000-0000-0000-0000000018c1', '2030-01-12')).polla_current_account_id,
  '{"collections": 50}', FALSE, 'a1000000-0000-0000-0000-000000000018'
);
SELECT is((pg_temp.row_of('a1000000-0000-0000-0000-0000000018c1', '2030-01-12')).successes,
          0.00::NUMERIC(12,2), 'al editar el día el premio sigue afuera');
SELECT is((pg_temp.row_of('a1000000-0000-0000-0000-0000000018c1', '2030-01-12')).total,
          130.00::NUMERIC(12,2), 'y el cobro se descuenta del saldo como siempre');

-- ---------------------------------------- lo liquidado conserva su premio

-- El pasador 2 ganó $5.000 el 5 y se liquidó el 6.
SELECT pg_temp.bet('R18-3', 'a1000000-0000-0000-0000-0000000018c2', '2030-01-04', 5000, '2030-01-05');
INSERT INTO polla_current_accounts (polla_user_id, user_name, user_number, polla_organization_id, date, is_liquidated)
VALUES ('a1000000-0000-0000-0000-0000000018c2', 'Liquidado', 2, 'a1000000-0000-0000-0000-000000000018', '2030-01-06', TRUE);

-- Recalcular el 5 (por ejemplo, al corregir un resultado viejo).
SELECT polla_calculate_current_account('05-01-2030', FALSE, FALSE, 'a1000000-0000-0000-0000-000000000018');
SELECT is((pg_temp.row_of('a1000000-0000-0000-0000-0000000018c2', '2030-01-05')).successes,
          5000.00::NUMERIC(12,2), 'un día ya liquidado conserva su premio');
SELECT is((pg_temp.row_of('a1000000-0000-0000-0000-0000000018c2', '2030-01-05')).subtotal,
          -5000.00::NUMERIC(12,2), 'y su subtotal de entonces');

SELECT polla_update_current_account_recompute(
  (pg_temp.row_of('a1000000-0000-0000-0000-0000000018c2', '2030-01-05')).polla_current_account_id,
  '{}', FALSE, 'a1000000-0000-0000-0000-000000000018'
);
SELECT is((pg_temp.row_of('a1000000-0000-0000-0000-0000000018c2', '2030-01-05')).successes,
          5000.00::NUMERIC(12,2), 'también al editarlo');

SELECT * FROM finish();
ROLLBACK;
