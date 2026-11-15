-- Cuenta por edición: cálculo en vivo (tickets, borradas, reclamos, cobros y
-- pagos, sin premios), ediciones solapadas, pasador dado de baja, liquidación
-- repetible con aviso de diferencias, vista del pasador, marca, lista y
-- totales.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(30);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-000000000175', 'pgTAP liquidación edición');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000175e001', 'a9000000-0000-0000-0000-000000000175', 'Grupo 175');

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
SELECT ('a9000000-0000-0000-0000-00000175c00' || n)::UUID, 'CASHIER', 'Pasador ' || n, n,
       'a9000000-0000-0000-0000-000000000175',
       CASE WHEN n <= 2 THEN 'a9000000-0000-0000-0000-00000175e001'::UUID END, 10, 0
FROM generate_series(1, 3) n;
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a9000000-0000-0000-0000-00000175d001', 'OWNER', 'Dueño 175', 'a9000000-0000-0000-0000-000000000175');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000175a001', 'a9000000-0000-0000-0000-000000000175', 'Nacional 175');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a9000000-0000-0000-0000-00000175b001', 'a9000000-0000-0000-0000-000000000175', 'Nocturna 175', '21:00');

CREATE TEMP TABLE eds (name TEXT PRIMARY KEY, id UUID NOT NULL);

-- p_past: la edición ya empezó y su carga cerró (si no, queda con la carga abierta).
CREATE FUNCTION pg_temp.edition(p_name TEXT, p_past BOOLEAN) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := (polla_create_edition(
    'a9000000-0000-0000-0000-000000000175',
    jsonb_build_object(
      'name', p_name, 'start_date', polla_today() + 1, 'end_date', polla_today() + 5,
      'load_limit_date', polla_today() + 1, 'load_limit_time', '20:00',
      'pool_amount', 1000, 'ticket_price', 100
    ),
    jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', 'a9000000-0000-0000-0000-00000175a001',
      'polla_schedule_id', 'a9000000-0000-0000-0000-00000175b001'))
  )->>'polla_edition_id')::UUID;
  IF p_past THEN
    UPDATE polla_editions
    SET load_start_date = polla_today() - 20, load_limit_date = polla_today() - 12,
        start_date = polla_today() - 10, end_date = polla_today() + 5
    WHERE polla_edition_id = v_id;
  END IF;
  INSERT INTO eds VALUES (p_name, v_id);
END;
$$;

CREATE FUNCTION pg_temp.ed(p_name TEXT) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM eds WHERE name = p_name;
$$;

CREATE FUNCTION pg_temp.cashier(p_n INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT ('a9000000-0000-0000-0000-00000175c00' || p_n)::UUID;
$$;

CREATE FUNCTION pg_temp.org() RETURNS UUID LANGUAGE sql AS $$
  SELECT 'a9000000-0000-0000-0000-000000000175'::UUID;
$$;

CREATE FUNCTION pg_temp.owner() RETURNS UUID LANGUAGE sql AS $$
  SELECT 'a9000000-0000-0000-0000-00000175d001'::UUID;
$$;

CREATE FUNCTION pg_temp.bet(p_edition TEXT, p_cashier INTEGER, p_ticket TEXT,
                            p_deleted_at TIMESTAMPTZ DEFAULT NULL, p_deducted DATE DEFAULT NULL) RETURNS VOID
LANGUAGE sql AS $$
  INSERT INTO polla_bets (
    ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id, polla_organization_id,
    user_name, cashier_name, cashier_number, load_date, amount, numbers, deleted_at, deducted_on
  ) VALUES (
    p_ticket, pg_temp.ed(p_edition), pg_temp.cashier(p_cashier), pg_temp.cashier(p_cashier),
    pg_temp.org(), 'Pasador ' || p_cashier, 'Pasador ' || p_cashier, p_cashier,
    polla_today() - 3, 100, ARRAY['01','02','03','04','05','06','07','08','09','10'], p_deleted_at, p_deducted
  );
$$;

CREATE FUNCTION pg_temp.movement(p_edition TEXT, p_cashier INTEGER, p_type polla_account_movement_type_enum,
                                 p_amount NUMERIC) RETURNS VOID
LANGUAGE sql AS $$
  INSERT INTO polla_edition_account_movements (polla_organization_id, polla_edition_id, polla_user_id, type, amount)
  VALUES (pg_temp.org(), pg_temp.ed(p_edition), pg_temp.cashier(p_cashier), p_type, p_amount);
$$;

-- La cuenta de un pasador en una edición.
CREATE FUNCTION pg_temp.acct(p_edition TEXT, p_cashier INTEGER) RETURNS JSONB LANGUAGE sql AS $$
  SELECT r FROM polla_edition_account_rows(pg_temp.org(), pg_temp.ed(p_edition), NULL, pg_temp.cashier(p_cashier)) r;
$$;

SELECT pg_temp.edition('A', TRUE);
SELECT pg_temp.edition('B', TRUE);
SELECT pg_temp.edition('C', FALSE);

-- A: P1 tiene tres tickets, uno borrado con descuento y otro sin descuento
-- (que no cuenta). P3 (dado de baja después) tiene uno.
SELECT pg_temp.bet('A', 1, 'T175-A1');
SELECT pg_temp.bet('A', 1, 'T175-A2');
SELECT pg_temp.bet('A', 1, 'T175-A3', NOW(), polla_today());
SELECT pg_temp.bet('A', 1, 'T175-A4', NOW(), NULL);
SELECT pg_temp.bet('A', 3, 'T175-A5');
UPDATE polla_users SET deleted_at = NOW() WHERE polla_user_id = pg_temp.cashier(3);
-- B (solapada con A): un ticket de P1, que gana $5.000.
SELECT pg_temp.bet('B', 1, 'T175-B1');
UPDATE polla_bets SET winner = TRUE, prize = 5000, hit_date = polla_today() WHERE ticket_number = 'T175-B1';

-- ------------------------------------------------------------- cuenta en vivo
SELECT is(pg_temp.acct('A', 1)->>'bets_pass', '300.00', 'pase bruto');
SELECT is(pg_temp.acct('A', 1)->>'deleted_pass', '100.00', 'borradas');
SELECT is(pg_temp.acct('A', 1)->>'pass', '200.00', 'pase');
SELECT is(pg_temp.acct('A', 1)->>'cashier_commission', '20.00', 'comisión');
SELECT is(pg_temp.acct('A', 1)->>'total', '180.00', 'debe');

-- Movimientos: reclamo +50, reclamo -30, cobro 100, pago 10.
SELECT pg_temp.movement('A', 1, 'CLAIM', 50);
SELECT pg_temp.movement('A', 1, 'CLAIM', -30);
SELECT pg_temp.movement('A', 1, 'COLLECTION', 100);
SELECT pg_temp.movement('A', 1, 'PAYMENT', 10);
-- Un movimiento de B en otro pasador no se cruza con A.
SELECT pg_temp.movement('B', 2, 'COLLECTION', 5);

SELECT is(pg_temp.acct('A', 1)->>'pass', '250.00', 'el reclamo positivo entra en el pase');
SELECT is(pg_temp.acct('A', 1)->>'subtotal', '195.00', '250 - 25 - 30');
SELECT is(pg_temp.acct('A', 1)->>'total', '105.00', '195 - 100 + 10');

SELECT is((SELECT count(*) FROM polla_edition_account_rows(pg_temp.org(), pg_temp.ed('A')) r
           WHERE r->>'polla_user_id' = pg_temp.cashier(2)::TEXT), 1::BIGINT,
  'el que no tiene nada aparece en cero');
SELECT is(pg_temp.acct('A', 3)->>'bets_pass', '100.00', 'el pasador dado de baja con tickets aparece');
SELECT is(pg_temp.acct('B', 1)->>'bets_pass', '100.00', 'B solo ve su ticket (solapadas)');
SELECT is(pg_temp.acct('B', 1)->>'claims', '0.00', 'los movimientos de A no pasan a B');
SELECT is(pg_temp.acct('B', 1)->>'total', '90.00', 'el premio no entra en la cuenta (R18): 100 - 10');

-- ------------------------------------------------------------------ liquidar
SELECT throws_ok(
  $$SELECT polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed('C'), ARRAY[pg_temp.cashier(1)], pg_temp.owner())$$,
  'P0001', 'POLLA_EDITION_LOAD_OPEN', 'con la carga abierta no');

SELECT is((polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed('A'), ARRAY[pg_temp.cashier(1)], pg_temp.owner()))->>'status',
  'LIQUIDATED', 'primera liquidación sin aviso');

-- El admin carga un ticket nuevo de 100 de P1 en A después del corte.
SELECT pg_temp.bet('A', 1, 'T175-A6');

SELECT is((polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed('A'), ARRAY[pg_temp.cashier(1)], pg_temp.owner()))->>'status',
  'DIFFERENCES', 'avisa la diferencia');
SELECT is((SELECT count(*) FROM polla_edition_liquidations WHERE polla_user_id = pg_temp.cashier(1)), 1::BIGINT,
  'el aviso no escribe');
CREATE TEMP TABLE old_liq AS
SELECT polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed('A'), ARRAY[pg_temp.cashier(1)], pg_temp.owner(), 'OLD')
  ->'liquidations'->0 AS l;
SELECT is((SELECT l->>'bets_pass' FROM old_liq), '300.00', 'con el viejo conserva el pase');
SELECT is((SELECT l->>'kept_previous_tickets' FROM old_liq), 'true', 'y queda marcada como que conservó los tickets');
SELECT is(pg_temp.acct('A', 1)->>'live_bets_pass', '400.00', 'y sigue mostrando el pase en vivo');
SELECT is((polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed('A'), ARRAY[pg_temp.cashier(1)], pg_temp.owner(), 'NEW'))
  ->'liquidations'->0->>'bets_pass', '400.00', 'con el nuevo toma el pase en vivo');

-- Solo cambia un cobro: no hay diferencia de tickets.
SELECT pg_temp.movement('A', 1, 'COLLECTION', 20);
SELECT is((polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed('A'), ARRAY[pg_temp.cashier(1)], pg_temp.owner()))->>'status',
  'LIQUIDATED', 'un cobro nuevo no dispara el aviso');

-- Se cambia el fee de P1 a 12 y entra otro cobro de 5 después de liquidar.
-- Vigente: pase 400 - 100 + 50 = 350, comisión 35, subtotal 350 - 35 - 30 = 285.
UPDATE polla_users SET fee = 12 WHERE polla_user_id = pg_temp.cashier(1);
SELECT pg_temp.movement('A', 1, 'COLLECTION', 5);
CREATE TEMP TABLE fee_diff AS
SELECT polla_liquidate_edition_accounts(pg_temp.org(), pg_temp.ed('A'), ARRAY[pg_temp.cashier(1)], pg_temp.owner()) AS r;
SELECT is((SELECT r->>'status' FROM fee_diff), 'DIFFERENCES', 'un fee distinto es diferencia');
SELECT is((SELECT r->'differences'->0->'old'->>'total' FROM fee_diff), '170.00',
  'el viejo: tickets y fee de la vigente con los movimientos de hoy (285 - 125 + 10)');
SELECT is((SELECT r->'differences'->0->'new'->>'total' FROM fee_diff), '163.00',
  'el nuevo: comisión 42 con fee 12 (350 - 42 - 30 - 125 + 10)');

-- ------------------------------------------------------- vista del pasador
SELECT is((SELECT count(*) FROM polla_user_edition_accounts(pg_temp.org(), pg_temp.cashier(1)) r
           WHERE r->>'polla_edition_id' = pg_temp.ed('A')::TEXT), 1::BIGINT,
  'el pasador ve la edición donde lo liquidaron');
SELECT is((SELECT count(*) FROM polla_user_edition_accounts(pg_temp.org(), pg_temp.cashier(1)) r
           WHERE r->>'polla_edition_id' = pg_temp.ed('B')::TEXT), 0::BIGINT,
  'con tickets pero sin liquidar no la ve');

-- ------------------------------------------------- marca, listas y totales
SELECT is((polla_set_edition_liquidated(pg_temp.org(), pg_temp.ed('A'), pg_temp.owner(), TRUE))->>'liquidated_at' IS NOT NULL,
  TRUE, 'marca');

-- Un gasto de A y se borra la edición B (que antes estaba en la lista).
INSERT INTO polla_org_expenses (polla_organization_id, date, name, amount, polla_edition_id)
VALUES (pg_temp.org(), polla_today(), 'Gasto A', 7, pg_temp.ed('A'));
UPDATE polla_editions SET deleted_at = NOW() WHERE polla_edition_id = pg_temp.ed('B');
SELECT is((SELECT count(*) FILTER (WHERE r->>'polla_edition_id' = pg_temp.ed('B')::TEXT)::TEXT || '/'
                  || count(*) FILTER (WHERE r->>'polla_edition_id' = pg_temp.ed('A')::TEXT)::TEXT
           FROM polla_edition_account_list(pg_temp.org()) r),
  '0/1', 'una edición borrada no aparece (y la vigente sí)');

-- Cobros 100 + 20 + 5, pagos 10, gastos 7.
SELECT is((SELECT r->>'net_balance' FROM polla_edition_account_totals(pg_temp.org(), ARRAY[pg_temp.ed('A')]) r),
  '108.00', 'totales de la edición: 125 - 10 - 7');

SELECT * FROM finish();
ROLLBACK;
