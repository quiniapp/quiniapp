-- R26 (ajuste): el mínimo de aciertos se cambia con la edición empezada,
-- aunque tenga ganadores, si no hay premios pagados. Si terminó por la
-- escalera o desierta, se recalculan ganadores y premios; si terminó por un
-- 10, no cambia nada; en juego, solo se guarda el número.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a8000000-0000-0000-0000-000000000026', 'pgTAP mínimo R26');

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, fee, fee_plus)
VALUES ('a8000000-0000-0000-0000-0000000026c1', 'CASHIER', 'Pasador mín', 1,
        'a8000000-0000-0000-0000-000000000026', 0, 0);
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a8000000-0000-0000-0000-0000000026d1', 'OWNER', 'Dueño mín', 'a8000000-0000-0000-0000-000000000026');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a8000000-0000-0000-0000-0000000026a1', 'a8000000-0000-0000-0000-000000000026', 'Nacional mín');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a8000000-0000-0000-0000-0000000026b1', 'a8000000-0000-0000-0000-000000000026', 'Nocturna mín', '21:00');

CREATE TEMP TABLE eds (name TEXT PRIMARY KEY, id UUID NOT NULL);

CREATE FUNCTION pg_temp.edition(p_name TEXT, p_start DATE, p_end DATE, p_min INTEGER) RETURNS VOID
LANGUAGE sql AS $$
  INSERT INTO eds VALUES (p_name, (polla_create_edition(
    'a8000000-0000-0000-0000-000000000026',
    jsonb_build_object(
      'name', p_name, 'start_date', p_start, 'end_date', p_end,
      'load_limit_date', p_start - 1, 'load_limit_time', '20:00',
      'pool_amount', 1000, 'ticket_price', 100, 'min_winning_hits', p_min
    ),
    jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', 'a8000000-0000-0000-0000-0000000026a1',
      'polla_schedule_id', 'a8000000-0000-0000-0000-0000000026b1'))
  )->>'polla_edition_id')::UUID);
$$;

CREATE FUNCTION pg_temp.ed(p_name TEXT) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM eds WHERE name = p_name;
$$;

-- Ticket con los números 01..10 (o los que se pasen).
CREATE FUNCTION pg_temp.bet(p_edition TEXT, p_ticket TEXT, p_numbers TEXT[]) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO polla_bets (
    ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id, polla_organization_id,
    user_name, cashier_name, cashier_number, load_date, amount, numbers
  ) VALUES (
    p_ticket, pg_temp.ed(p_edition),
    'a8000000-0000-0000-0000-0000000026c1', 'a8000000-0000-0000-0000-0000000026c1',
    'a8000000-0000-0000-0000-000000000026',
    'Pasador mín', 'Pasador mín', 1, '2030-05-01', 100, p_numbers
  );
$$;

CREATE FUNCTION pg_temp.result(p_date DATE, p_numbers TEXT[]) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO polla_results (polla_organization_id, polla_lottery_id, polla_schedule_id, date, results)
  VALUES (
    'a8000000-0000-0000-0000-000000000026', 'a8000000-0000-0000-0000-0000000026a1',
    'a8000000-0000-0000-0000-0000000026b1', p_date,
    p_numbers || array_fill('99'::TEXT, ARRAY[20 - cardinality(p_numbers)])
  );
$$;

CREATE FUNCTION pg_temp.set_min(p_edition TEXT, p_min INTEGER) RETURNS JSONB LANGUAGE sql AS $$
  SELECT polla_update_edition(pg_temp.ed(p_edition), jsonb_build_object('min_winning_hits', p_min));
$$;

CREATE FUNCTION pg_temp.winners(p_edition TEXT) RETURNS TEXT[] LANGUAGE sql AS $$
  SELECT COALESCE(array_agg(ticket_number ORDER BY ticket_number), '{}')
  FROM polla_bets WHERE polla_edition_id = pg_temp.ed(p_edition) AND winner AND deleted_at IS NULL;
$$;

CREATE FUNCTION pg_temp.ed_row(p_edition TEXT) RETURNS polla_editions LANGUAGE sql AS $$
  SELECT * FROM polla_editions WHERE polla_edition_id = pg_temp.ed(p_edition);
$$;

-- -------------------------------- desierta con mínimo 10 → baja a 8

SELECT pg_temp.edition('des', '2030-06-10', '2030-06-10', 10);
SELECT pg_temp.bet('des', 'D9', ARRAY['01','02','03','04','05','06','07','08','09','10']);
SELECT pg_temp.bet('des', 'D8', ARRAY['01','02','03','04','05','06','07','08','50','51']);
SELECT pg_temp.result('2030-06-10', ARRAY['01','02','03','04','05','06','07','08','09']);
SELECT polla_process_edition_hits(pg_temp.ed('des'), '2030-06-10');

SELECT is((pg_temp.ed_row('des')).status::TEXT, 'FINISHED', 'con mínimo 10 y nadie en 10, queda desierta');
SELECT is(pg_temp.winners('des'), '{}'::TEXT[], 'sin ganadores');

SELECT lives_ok($$SELECT pg_temp.set_min('des', 8)$$, 'con la edición terminada se puede bajar el mínimo');
SELECT is(pg_temp.winners('des'), ARRAY['D9'], 'y se recalculan los ganadores: el de 9');
SELECT is(
  (SELECT prize FROM polla_bets WHERE ticket_number = 'D9'),
  1000.00::NUMERIC(12,2),
  'con su premio'
);
SELECT is((pg_temp.ed_row('des')).winner_date, '2030-06-10'::DATE, 'la edición queda con ganador');

-- --------------------------------- con ganadores → vuelve a desierta

SELECT lives_ok($$SELECT pg_temp.set_min('des', 10)$$, 'con ganadores también se cambia el mínimo');
SELECT is(pg_temp.winners('des'), '{}'::TEXT[], 'si nadie llega al mínimo nuevo, se sacan los ganadores');
SELECT is(
  (SELECT prize FROM polla_bets WHERE ticket_number = 'D9'),
  0::NUMERIC(12,2),
  'y el premio'
);
SELECT is((pg_temp.ed_row('des')).winner_date, NULL, 'y vuelve a quedar desierta');

-- ------------------------------------------ con un premio pagado, no

SELECT pg_temp.set_min('des', 9);
UPDATE polla_bets SET prize_paid_at = NOW(), prize_paid_by = 'a8000000-0000-0000-0000-0000000026d1'
WHERE ticket_number = 'D9';
SELECT throws_ok(
  $$SELECT pg_temp.set_min('des', 8)$$,
  'P0001', 'POLLA_EDITION_PRIZE_PAID_LOCKED',
  'con un premio pagado el mínimo ya no se cambia'
);
SELECT throws_ok(
  $$SELECT polla_update_edition(pg_temp.ed('des'), jsonb_build_object('pool_amount', 2000))$$,
  'P0001', 'POLLA_EDITION_HAS_WINNERS_LOCKED',
  'con ganadores el resto sigue fijo'
);

-- -------------------------------------------------- en juego

SELECT pg_temp.edition('juego', '2030-07-01', '2030-07-02', 9);
SELECT pg_temp.bet('juego', 'J1', ARRAY['01','02','03','04','05','06','07','08','09','10']);
SELECT pg_temp.result('2030-07-01', ARRAY['01','02','03']);
SELECT polla_process_edition_hits(pg_temp.ed('juego'), '2030-07-01');

SELECT lives_ok($$SELECT pg_temp.set_min('juego', 8)$$, 'con sorteos cargados y en juego se cambia el mínimo');
SELECT is((pg_temp.ed_row('juego')).min_winning_hits, 8::SMALLINT, 'queda guardado');
SELECT is((pg_temp.ed_row('juego')).status::TEXT, 'ACTIVE', 'y la edición sigue en juego');

-- ------------------------------------------- terminó por un 10

SELECT pg_temp.edition('diez', '2030-08-01', '2030-08-03', 9);
SELECT pg_temp.bet('diez', 'T10', ARRAY['01','02','03','04','05','06','07','08','09','10']);
SELECT pg_temp.result('2030-08-01', ARRAY['01','02','03','04','05','06','07','08','09','10']);
SELECT polla_process_edition_hits(pg_temp.ed('diez'), '2030-08-01');

SELECT lives_ok($$SELECT pg_temp.set_min('diez', 8)$$, 'si ganó un 10, el mínimo se cambia igual');
SELECT is(pg_temp.winners('diez'), ARRAY['T10'], 'y el ganador sigue siendo el del 10');

SELECT * FROM finish();
ROLLBACK;
