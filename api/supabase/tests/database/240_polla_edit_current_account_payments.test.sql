-- Editar cobros y pagos del historial por fecha (polla_edit_current_account_payments):
-- la diferencia del día se suma al total del día editado y al saldo anterior y
-- al total de cada día siguiente del pasador, liquidado o no. Nada más cambia.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(26);

INSERT INTO polla_organizations (polla_organization_id, name) VALUES
  ('a9000000-0000-0000-0000-000000000240', 'pgTAP editar historial'),
  ('a9000000-0000-0000-0000-000000000241', 'pgTAP editar historial (otra)');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name) VALUES
  ('a9000000-0000-0000-0000-00000240e001', 'a9000000-0000-0000-0000-000000000240', 'Grupo 240'),
  ('a9000000-0000-0000-0000-00000241e001', 'a9000000-0000-0000-0000-000000000241', 'Grupo 241');

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus) VALUES
  ('a9000000-0000-0000-0000-00000240c001', 'CASHIER', 'Pasador 1', 1,
   'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240e001', 10, 0),
  ('a9000000-0000-0000-0000-00000240c002', 'CASHIER', 'Pasador 2', 2,
   'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240e001', 10, 0),
  ('a9000000-0000-0000-0000-00000241c001', 'CASHIER', 'Pasador otra', 1,
   'a9000000-0000-0000-0000-000000000241', 'a9000000-0000-0000-0000-00000241e001', 10, 0);

-- Pasador 1: d1 y d2 liquidados, d3 sin liquidar (dos días después de d2).
-- El pasador 2 y el de la otra organización tienen una fila cada uno.
INSERT INTO polla_current_accounts (
  polla_current_account_id, polla_user_id, user_name, user_number, polla_organization_id,
  polla_group_id, date, bets_pass, deleted_pass, pass, successes, claims, cashier_commission,
  subtotal, revenue, previous_balance, previous_drag, collections, paid, bills, total, drag,
  leave, is_liquidated, edited_at
) VALUES
  ('a9000000-0000-0000-0000-00000240d001', 'a9000000-0000-0000-0000-00000240c001', 'Pasador 1', 1,
   'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240e001', '2026-03-02',
   1300, 100, 1220, 0, 20, 122, 1098, 1000, 0, 0, 0, 0, 0, 1000, 30, 5, TRUE, '2026-01-01'),
  ('a9000000-0000-0000-0000-00000240d002', 'a9000000-0000-0000-0000-00000240c001', 'Pasador 1', 1,
   'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240e001', '2026-03-03',
   800, 0, 800, 0, 0, 80, 720, 600, 1000, 30, 150, 50, 0, 1500, 40, 0, TRUE, '2026-01-01'),
  ('a9000000-0000-0000-0000-00000240d003', 'a9000000-0000-0000-0000-00000240c001', 'Pasador 1', 1,
   'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240e001', '2026-03-05',
   400, 0, 400, 0, 0, 40, 360, 300, 1500, 40, 0, 0, 0, 1800, 10, 0, FALSE, '2026-01-01'),
  ('a9000000-0000-0000-0000-00000240d201', 'a9000000-0000-0000-0000-00000240c002', 'Pasador 2', 2,
   'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240e001', '2026-03-04',
   500, 0, 500, 0, 0, 50, 450, 450, 200, 0, 10, 0, 0, 640, 0, 0, FALSE, '2026-01-01'),
  ('a9000000-0000-0000-0000-00000241d001', 'a9000000-0000-0000-0000-00000241c001', 'Pasador otra', 1,
   'a9000000-0000-0000-0000-000000000241', 'a9000000-0000-0000-0000-00000241e001', '2026-03-02',
   500, 0, 500, 0, 0, 50, 450, 450, 0, 0, 0, 0, 0, 450, 0, 0, TRUE, '2026-01-01');

CREATE TEMP TABLE snap AS SELECT * FROM polla_current_accounts
WHERE polla_organization_id IN ('a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-000000000241');

CREATE FUNCTION pg_temp.amounts(p_id UUID)
RETURNS TABLE (previous_balance NUMERIC, collections NUMERIC, paid NUMERIC, total NUMERIC)
LANGUAGE sql AS $$
  SELECT previous_balance, collections, paid, total FROM polla_current_accounts
  WHERE polla_current_account_id = p_id;
$$;

-- Columnas que la edición nunca toca.
CREATE FUNCTION pg_temp.frozen(p_from_snap BOOLEAN)
RETURNS TABLE (
  date DATE, bets_pass NUMERIC, deleted_pass NUMERIC, pass NUMERIC, successes NUMERIC,
  claims NUMERIC, cashier_commission NUMERIC, subtotal NUMERIC, revenue NUMERIC,
  previous_drag NUMERIC, bills NUMERIC, drag NUMERIC, leave NUMERIC, is_liquidated BOOLEAN
)
LANGUAGE sql AS $$
  SELECT date, bets_pass, deleted_pass, pass, successes, claims, cashier_commission, subtotal,
         revenue, previous_drag, bills, drag, leave, is_liquidated
  FROM polla_current_accounts
  WHERE NOT p_from_snap AND polla_user_id = 'a9000000-0000-0000-0000-00000240c001'
  UNION ALL
  SELECT date, bets_pass, deleted_pass, pass, successes, claims, cashier_commission, subtotal,
         revenue, previous_drag, bills, drag, leave, is_liquidated
  FROM snap
  WHERE p_from_snap AND polla_user_id = 'a9000000-0000-0000-0000-00000240c001'
  ORDER BY date;
$$;

CREATE FUNCTION pg_temp.same_as_snap(p_id UUID) RETURNS BOOLEAN LANGUAGE sql AS $$
  SELECT (SELECT to_jsonb(c) FROM polla_current_accounts c WHERE polla_current_account_id = p_id)
       = (SELECT to_jsonb(s) FROM snap s WHERE polla_current_account_id = p_id);
$$;

SELECT has_function(
  'polla_edit_current_account_payments', ARRAY['uuid', 'uuid', 'numeric', 'numeric'],
  'existe polla_edit_current_account_payments(uuid, uuid, numeric, numeric)');

-- ------------------------------------------------------------ editar d1

CREATE TEMP TABLE edited AS
SELECT * FROM polla_edit_current_account_payments(
  'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240d001', 300, 0);

SELECT results_eq(
  $$SELECT polla_current_account_id, collections, paid, total FROM edited$$,
  $$VALUES ('a9000000-0000-0000-0000-00000240d001'::UUID, 300::NUMERIC, 0::NUMERIC, 700::NUMERIC)$$,
  'devuelve la fila editada con los cobros y el total nuevos');

SELECT results_eq(
  $$SELECT * FROM pg_temp.amounts('a9000000-0000-0000-0000-00000240d001')$$,
  $$VALUES (0::NUMERIC, 300::NUMERIC, 0::NUMERIC, 700::NUMERIC)$$,
  'd1: cobros 300 y el total baja 300 (1000 -> 700); el saldo anterior no cambia');

SELECT results_eq(
  $$SELECT * FROM pg_temp.amounts('a9000000-0000-0000-0000-00000240d002')$$,
  $$VALUES (700::NUMERIC, 150::NUMERIC, 50::NUMERIC, 1200::NUMERIC)$$,
  'd2 (liquidado): saldo anterior 700 y total 1200; sus cobros y pagos no cambian');

SELECT results_eq(
  $$SELECT * FROM pg_temp.amounts('a9000000-0000-0000-0000-00000240d003')$$,
  $$VALUES (1200::NUMERIC, 0::NUMERIC, 0::NUMERIC, 1500::NUMERIC)$$,
  'd3 (sin liquidar): saldo anterior 1200 y total 1500');

SELECT results_eq(
  'SELECT * FROM pg_temp.frozen(FALSE)',
  'SELECT * FROM pg_temp.frozen(TRUE)',
  'nada más cambia: pase, borradas, premios, reclamos, comisión, subtotal, ganancia, arrastres, gastos, deje e is_liquidated');

SELECT is(
  (SELECT count(*) FROM polla_current_accounts
   WHERE polla_user_id = 'a9000000-0000-0000-0000-00000240c001' AND edited_at = NOW()),
  3::BIGINT, 'edited_at = NOW() en el día editado y en los siguientes');

SELECT ok(pg_temp.same_as_snap('a9000000-0000-0000-0000-00000240d201'),
  'la fila de otro pasador no cambia');

SELECT ok(pg_temp.same_as_snap('a9000000-0000-0000-0000-00000241d001'),
  'la fila de otra organización no cambia');

-- ------------------------------------------------------------ último día

DROP TABLE snap;
CREATE TEMP TABLE snap AS SELECT * FROM polla_current_accounts
WHERE polla_organization_id IN ('a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-000000000241');

SELECT lives_ok(
  $$SELECT polla_edit_current_account_payments(
      'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240d003', 0, 50)$$,
  'edita el último día del pasador (sin días siguientes)');

SELECT results_eq(
  $$SELECT * FROM pg_temp.amounts('a9000000-0000-0000-0000-00000240d003')$$,
  $$VALUES (1200::NUMERIC, 0::NUMERIC, 50::NUMERIC, 1550::NUMERIC)$$,
  'd3: pagos 50 y el total sube 50 (1500 -> 1550)');

SELECT ok(pg_temp.same_as_snap('a9000000-0000-0000-0000-00000240d001')
          AND pg_temp.same_as_snap('a9000000-0000-0000-0000-00000240d002'),
  'editar el último día no toca d1 ni d2');

-- ------------------------------------------------------------ día del medio, cobros y pagos

DROP TABLE snap;
CREATE TEMP TABLE snap AS SELECT * FROM polla_current_accounts
WHERE polla_organization_id IN ('a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-000000000241');

-- d2: cobros 150 -> 100 (+50) y pagos 50 -> 80 (+30): diferencia +80.
SELECT lives_ok(
  $$SELECT polla_edit_current_account_payments(
      'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240d002', 100, 80)$$,
  'edita cobros y pagos de un día del medio');

SELECT results_eq(
  $$SELECT * FROM pg_temp.amounts('a9000000-0000-0000-0000-00000240d002')$$,
  $$VALUES (700::NUMERIC, 100::NUMERIC, 80::NUMERIC, 1280::NUMERIC)$$,
  'd2: menos cobros y más pagos suben el total 80 (1200 -> 1280)');

SELECT results_eq(
  $$SELECT * FROM pg_temp.amounts('a9000000-0000-0000-0000-00000240d003')$$,
  $$VALUES (1280::NUMERIC, 0::NUMERIC, 50::NUMERIC, 1630::NUMERIC)$$,
  'd3: saldo anterior 1280 y total 1630');

SELECT ok(pg_temp.same_as_snap('a9000000-0000-0000-0000-00000240d001'),
  'editar d2 no toca d1');

-- ------------------------------------------------------------ sin diferencia

UPDATE polla_current_accounts SET edited_at = '2026-01-01'
WHERE polla_current_account_id = 'a9000000-0000-0000-0000-00000240d003';

SELECT polla_edit_current_account_payments(
  'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240d002', 100, 80);

SELECT is(
  (SELECT edited_at FROM polla_current_accounts
   WHERE polla_current_account_id = 'a9000000-0000-0000-0000-00000240d003'),
  '2026-01-01'::TIMESTAMPTZ, 'sin diferencia, los días siguientes no se tocan');

-- ------------------------------------------------------------ errores

SELECT throws_ok(
  $$SELECT polla_edit_current_account_payments(
      'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240d001', -1, 0)$$,
  'POLLA_CURRENT_ACCOUNT_AMOUNT_INVALID', 'cobros negativos: monto inválido');

SELECT throws_ok(
  $$SELECT polla_edit_current_account_payments(
      'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240d001', 0, -0.01)$$,
  'POLLA_CURRENT_ACCOUNT_AMOUNT_INVALID', 'pagos negativos: monto inválido');

SELECT throws_ok(
  $$SELECT polla_edit_current_account_payments(
      'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240d001', NULL, 0)$$,
  'POLLA_CURRENT_ACCOUNT_AMOUNT_INVALID', 'cobros vacíos: monto inválido');

SELECT throws_ok(
  $$SELECT polla_edit_current_account_payments(
      'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240d001', 0, NULL)$$,
  'POLLA_CURRENT_ACCOUNT_AMOUNT_INVALID', 'pagos vacíos: monto inválido');

SELECT throws_ok(
  $$SELECT polla_edit_current_account_payments(
      'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000240d001', 1.234, 0)$$,
  'POLLA_CURRENT_ACCOUNT_AMOUNT_INVALID', 'más de 2 decimales: monto inválido');

SELECT throws_ok(
  $$SELECT polla_edit_current_account_payments(
      'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-00000241d001', 10, 0)$$,
  'POLLA_CURRENT_ACCOUNT_NOT_FOUND', 'un día de otra organización: no existe');

SELECT throws_ok(
  $$SELECT polla_edit_current_account_payments(
      'a9000000-0000-0000-0000-000000000240', 'a9000000-0000-0000-0000-0000000000ff', 10, 0)$$,
  'POLLA_CURRENT_ACCOUNT_NOT_FOUND', 'un día que no existe');

SELECT results_eq(
  $$SELECT * FROM pg_temp.amounts('a9000000-0000-0000-0000-00000241d001')$$,
  $$VALUES (0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 450::NUMERIC)$$,
  'la fila de la otra organización sigue igual');

SELECT results_eq(
  $$SELECT * FROM pg_temp.amounts('a9000000-0000-0000-0000-00000240d001')$$,
  $$VALUES (0::NUMERIC, 300::NUMERIC, 0::NUMERIC, 700::NUMERIC)$$,
  'los intentos fallidos no cambian d1');

SELECT * FROM finish();
ROLLBACK;
