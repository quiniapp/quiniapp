-- R26: regla de premio con varios sorteos por edición y mínimo de aciertos.
--
-- Una organización con 5 quinielas del turno de las 21 h (y uno de las 18 h
-- para el corte de carga). Cada caso usa su propio día, porque los resultados
-- son de la organización y valen para todas sus ediciones. Los resultados se
-- completan con 99, que ningún ticket juega.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(57);

-- ------------------------------------------------------------------ datos

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('b0000000-0000-0000-0000-000000000026', 'pgTAP R26');

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, fee, fee_plus)
VALUES ('b0000000-0000-0000-0000-0000000026c1', 'CASHIER', 'Pasador R26', 1,
        'b0000000-0000-0000-0000-000000000026', 0, 0);

INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('b0000000-0000-0000-0000-0000000026d1', 'SUPERADMIN', 'Admin R26',
        'b0000000-0000-0000-0000-000000000026');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name, "order")
SELECT ('b0000000-0000-0000-0000-0000000026a' || i)::UUID,
       'b0000000-0000-0000-0000-000000000026',
       'Quiniela R26 ' || i,
       i
FROM generate_series(1, 5) i;

INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time) VALUES
  ('b0000000-0000-0000-0000-0000000026b1', 'b0000000-0000-0000-0000-000000000026', 'Nocturna R26', '21:00'),
  ('b0000000-0000-0000-0000-0000000026b2', 'b0000000-0000-0000-0000-000000000026', 'Vespertina R26', '18:00');

-- Otra organización, para probar que no se usan sus quinielas.
INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('b0000000-0000-0000-0000-000000000126', 'pgTAP R26 otra');
INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('b0000000-0000-0000-0000-0000000126a1', 'b0000000-0000-0000-0000-000000000126', 'Ajena R26');

CREATE TEMP TABLE eds (name TEXT PRIMARY KEY, id UUID NOT NULL);

CREATE FUNCTION pg_temp.lot(p_i INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT ('b0000000-0000-0000-0000-0000000026a' || p_i)::UUID;
$$;

-- Sorteos del turno de las 21 h de esas quinielas.
CREATE FUNCTION pg_temp.draws(VARIADIC p_lotteries INTEGER[]) RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_agg(jsonb_build_object(
    'polla_lottery_id', pg_temp.lot(i),
    'polla_schedule_id', 'b0000000-0000-0000-0000-0000000026b1'
  ))
  FROM unnest(p_lotteries) i;
$$;

CREATE FUNCTION pg_temp.payload(
  p_name TEXT, p_start DATE, p_end DATE, p_min INTEGER, p_pool NUMERIC, p_surprise NUMERIC
) RETURNS JSONB LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'name', p_name,
    'start_date', p_start,
    'end_date', p_end,
    'load_limit_date', p_start - 1,
    'load_limit_time', '20:00',
    'pool_amount', p_pool,
    'surprise_pool_amount', p_surprise,
    'ticket_price', 100,
    'min_winning_hits', p_min
  );
$$;

CREATE FUNCTION pg_temp.edition(
  p_name TEXT, p_draws JSONB, p_start DATE, p_end DATE, p_min INTEGER,
  p_pool NUMERIC DEFAULT 1000, p_surprise NUMERIC DEFAULT 0
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := (polla_create_edition(
    'b0000000-0000-0000-0000-000000000026',
    pg_temp.payload(p_name, p_start, p_end, p_min, p_pool, p_surprise),
    p_draws
  )->>'polla_edition_id')::UUID;
  INSERT INTO eds VALUES (p_name, v_id);
  RETURN v_id;
END;
$$;

CREATE FUNCTION pg_temp.ed(p_name TEXT) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM eds WHERE name = p_name;
$$;

CREATE FUNCTION pg_temp.bet(p_edition TEXT, p_ticket TEXT, p_numbers TEXT[]) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO polla_bets (
    ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id, polla_organization_id,
    user_name, cashier_name, cashier_number, load_date, amount, numbers
  ) VALUES (
    p_ticket, pg_temp.ed(p_edition),
    'b0000000-0000-0000-0000-0000000026c1', 'b0000000-0000-0000-0000-0000000026c1',
    'b0000000-0000-0000-0000-000000000026',
    'Pasador R26', 'Pasador R26', 1, '2030-04-01', 100, p_numbers
  );
$$;

CREATE FUNCTION pg_temp.result(p_lottery INTEGER, p_date DATE, p_numbers TEXT[]) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO polla_results (polla_organization_id, polla_lottery_id, polla_schedule_id, date, results)
  VALUES (
    'b0000000-0000-0000-0000-000000000026', pg_temp.lot(p_lottery),
    'b0000000-0000-0000-0000-0000000026b1', p_date,
    p_numbers || array_fill('99'::TEXT, ARRAY[20 - cardinality(p_numbers)])
  );
$$;

CREATE FUNCTION pg_temp.process(p_edition TEXT, p_date DATE) RETURNS JSONB LANGUAGE sql AS $$
  SELECT polla_process_edition_hits(pg_temp.ed(p_edition), p_date);
$$;

CREATE FUNCTION pg_temp.bet_of(p_ticket TEXT) RETURNS polla_bets LANGUAGE sql AS $$
  SELECT * FROM polla_bets WHERE ticket_number = p_ticket;
$$;

CREATE FUNCTION pg_temp.edition_of(p_name TEXT) RETURNS polla_editions LANGUAGE sql AS $$
  SELECT * FROM polla_editions WHERE polla_edition_id = pg_temp.ed(p_name);
$$;

-- ------------------------------------------------------ alta de ediciones

SELECT pg_temp.edition('A', pg_temp.draws(1, 2, 3, 4, 5), '2030-04-06', '2030-04-06', 8);

SELECT is(
  (SELECT COUNT(*)::INT FROM polla_edition_draws WHERE polla_edition_id = pg_temp.ed('A')),
  5,
  'la especial queda con sus 5 sorteos'
);
SELECT is((pg_temp.edition_of('A')).min_winning_hits, 8::SMALLINT, 'guarda el mínimo de aciertos');

SELECT pg_temp.edition('Mixta', jsonb_build_array(
  jsonb_build_object('polla_lottery_id', pg_temp.lot(1), 'polla_schedule_id', 'b0000000-0000-0000-0000-0000000026b1'),
  jsonb_build_object('polla_lottery_id', pg_temp.lot(2), 'polla_schedule_id', 'b0000000-0000-0000-0000-0000000026b2')
), '2030-05-06', '2030-05-06', NULL);

SELECT is(
  (pg_temp.edition_of('Mixta')).polla_schedule_id,
  'b0000000-0000-0000-0000-0000000026b2'::UUID,
  'el sorteo principal es el de horario más temprano (define el corte de carga)'
);
SELECT is((pg_temp.edition_of('Mixta')).polla_lottery_id, pg_temp.lot(2), 'y su quiniela');
SELECT is((pg_temp.edition_of('Mixta')).min_winning_hits, 10::SMALLINT, 'sin mínimo queda en 10 (regular)');
SELECT is(
  (SELECT jsonb_array_length(polla_edition_with_draws(e)->'draws') FROM polla_editions e
   WHERE e.polla_edition_id = pg_temp.ed('Mixta')),
  2,
  'la edición se devuelve con sus sorteos'
);

SELECT throws_ok(
  $$SELECT polla_create_edition(
      'b0000000-0000-0000-0000-000000000026',
      jsonb_set(pg_temp.payload('Tarde', '2030-05-07', '2030-05-07', NULL, 1000, 0),
                '{load_limit_date}', '"2030-05-07"') || '{"load_limit_time": "19:00"}',
      jsonb_build_array(
        jsonb_build_object('polla_lottery_id', pg_temp.lot(1), 'polla_schedule_id', 'b0000000-0000-0000-0000-0000000026b1'),
        jsonb_build_object('polla_lottery_id', pg_temp.lot(2), 'polla_schedule_id', 'b0000000-0000-0000-0000-0000000026b2')
      ))$$,
  'P0001',
  'POLLA_LOAD_LIMIT_AFTER_FIRST_DRAW',
  'el cierre de carga tiene que ser antes del sorteo más temprano'
);
SELECT throws_ok(
  $$SELECT polla_create_edition('b0000000-0000-0000-0000-000000000026',
      pg_temp.payload('Vacía', '2030-05-08', '2030-05-08', NULL, 1000, 0), '[]'::JSONB)$$,
  'P0001',
  'POLLA_EDITION_DRAWS_REQUIRED',
  'sin sorteos no se crea'
);
SELECT throws_ok(
  $$SELECT polla_create_edition('b0000000-0000-0000-0000-000000000026',
      pg_temp.payload('Ajena', '2030-05-08', '2030-05-08', NULL, 1000, 0),
      jsonb_build_array(jsonb_build_object(
        'polla_lottery_id', 'b0000000-0000-0000-0000-0000000126a1',
        'polla_schedule_id', 'b0000000-0000-0000-0000-0000000026b1')))$$,
  'P0001',
  'POLLA_EDITION_DRAW_INVALID',
  'no acepta quinielas de otra organización'
);
SELECT throws_ok(
  $$SELECT polla_create_edition('b0000000-0000-0000-0000-000000000026',
      pg_temp.payload('Once', '2030-05-08', '2030-05-08', 11, 1000, 0), pg_temp.draws(1))$$,
  '23514',
  NULL,
  'el mínimo de aciertos va de 1 a 10'
);

-- --------------------------------------------- A: alguien completa 10

-- Los 10 números salen repartidos entre las 5 quinielas.
SELECT pg_temp.bet('A', 'R26-A1', ARRAY['01','02','03','04','05','06','07','08','09','10']);
SELECT pg_temp.bet('A', 'R26-A2', ARRAY['01','02','03','04','05','06','07','08','09','98']);
SELECT pg_temp.result(1, '2030-04-06', ARRAY['01','02']);
SELECT pg_temp.result(2, '2030-04-06', ARRAY['03','04']);
SELECT pg_temp.result(3, '2030-04-06', ARRAY['05','06']);
SELECT pg_temp.result(4, '2030-04-06', ARRAY['07','08']);
SELECT pg_temp.result(5, '2030-04-06', ARRAY['09','10']);

CREATE TEMP TABLE processed_a AS
SELECT polla_process_results_and_accounts(
  'b0000000-0000-0000-0000-000000000026',
  'b0000000-0000-0000-0000-0000000026b1',
  '2030-04-06'
) AS r;

SELECT is(
  (SELECT jsonb_array_length(r->'editions') FROM processed_a),
  1,
  'el turno procesa la edición que tiene sorteos de ese turno'
);
SELECT is((pg_temp.bet_of('R26-A1')).hits, 10, 'los aciertos suman las 5 quinielas');
SELECT is((pg_temp.bet_of('R26-A1')).winner, TRUE, 'gana el que completa 10');
SELECT is((pg_temp.bet_of('R26-A1')).prize, 1000.00::NUMERIC(12,2), 'se lleva todo el pozo');
SELECT is((pg_temp.bet_of('R26-A2')).winner, FALSE, 'con alguien en 10, el de 9 no gana');
SELECT is((pg_temp.edition_of('A')).status, 'FINISHED'::polla_edition_status_enum, 'la edición termina');
SELECT is((pg_temp.edition_of('A')).winner_date, '2030-04-06'::DATE, 'con ganador ese día');

-- ------------------------- B: nadie en 10, ganan los de 9 (multiconjunto)

SELECT pg_temp.edition('B', pg_temp.draws(1, 2, 3, 4, 5), '2030-04-07', '2030-04-07', 8);
-- El 32 sale en dos quinielas y el 33 en una sola.
SELECT pg_temp.result(1, '2030-04-07', ARRAY['01','02','32']);
SELECT pg_temp.result(2, '2030-04-07', ARRAY['03','04']);
SELECT pg_temp.result(3, '2030-04-07', ARRAY['05','06','33']);
SELECT pg_temp.result(4, '2030-04-07', ARRAY['07','08']);
SELECT pg_temp.result(5, '2030-04-07', ARRAY['32']);
SELECT pg_temp.bet('B', 'R26-B1', ARRAY['01','02','03','04','05','06','07','08','32','77']);
SELECT pg_temp.bet('B', 'R26-B2', ARRAY['01','02','03','04','05','06','07','32','32','77']);
SELECT pg_temp.bet('B', 'R26-B3', ARRAY['01','02','03','04','05','06','07','08','77','78']);
SELECT pg_temp.bet('B', 'R26-B4', ARRAY['01','02','03','04','05','06','07','33','33','77']);
SELECT pg_temp.process('B', '2030-04-07');

SELECT is((pg_temp.bet_of('R26-B2')).hits, 9, 'un número jugado dos veces acierta dos veces si sale en dos quinielas');
SELECT is((pg_temp.bet_of('R26-B4')).hits, 8, 'y una sola si sale una vez');
SELECT is((pg_temp.bet_of('R26-B1')).winner, TRUE, 'sin nadie en 10, gana el de 9');
SELECT is((pg_temp.bet_of('R26-B2')).winner, TRUE, 'el otro de 9 también');
SELECT is((pg_temp.bet_of('R26-B1')).prize, 500.00::NUMERIC(12,2), 'el pozo se reparte en partes iguales');
SELECT is((pg_temp.bet_of('R26-B3')).winner, FALSE, 'con ganadores de 9, el de 8 no gana');
SELECT is((pg_temp.bet_of('R26-B1')).hit_date, '2030-04-07'::DATE, 'el premio es del último día de la edición');
SELECT is((pg_temp.edition_of('B')).winner_date, '2030-04-07'::DATE, 'la edición queda con ganador');

-- ---------------------------------------- C: solo hay de 8, con sorpresa

SELECT pg_temp.edition('C', pg_temp.draws(1, 2, 3, 4, 5), '2030-04-08', '2030-04-08', 8, 1000, 200);
SELECT pg_temp.result(1, '2030-04-08', ARRAY['01','02']);
SELECT pg_temp.result(2, '2030-04-08', ARRAY['03','04']);
SELECT pg_temp.result(3, '2030-04-08', ARRAY['05','06']);
SELECT pg_temp.result(4, '2030-04-08', ARRAY['07','08']);
SELECT pg_temp.result(5, '2030-04-08', ARRAY[]::TEXT[]);
SELECT pg_temp.bet('C', 'R26-C1', ARRAY['01','02','03','04','05','06','07','08','77','78']);
SELECT pg_temp.bet('C', 'R26-C2', ARRAY['01','02','03','04','05','06','07','77','78','79']);
SELECT pg_temp.process('C', '2030-04-08');

SELECT is((pg_temp.bet_of('R26-C1')).winner, TRUE, 'sin 10 ni 9, gana el de 8');
SELECT is((pg_temp.bet_of('R26-C1')).prize, 1200.00::NUMERIC(12,2), 'con el pozo sorpresa sumado');
SELECT is((pg_temp.bet_of('R26-C2')).winner, FALSE, 'el de 7 no gana');

-- ------------------------------------------- D: nadie llega a 8, desierta

SELECT pg_temp.edition('D', pg_temp.draws(1, 2, 3, 4, 5), '2030-04-09', '2030-04-09', 8);
SELECT pg_temp.result(1, '2030-04-09', ARRAY['01','02','03','04','05','06','07']);
SELECT pg_temp.result(i, '2030-04-09', ARRAY[]::TEXT[]) FROM generate_series(2, 5) i;
SELECT pg_temp.bet('D', 'R26-D1', ARRAY['01','02','03','04','05','06','07','77','78','79']);
SELECT pg_temp.process('D', '2030-04-09');

SELECT is((pg_temp.bet_of('R26-D1')).winner, FALSE, 'con 7 no gana nadie');
SELECT is((pg_temp.edition_of('D')).status, 'FINISHED'::polla_edition_status_enum, 'la edición termina');
SELECT is((pg_temp.edition_of('D')).winner_date, NULL::DATE, 'desierta, sin ganador');

-- ---------------------- E: completa 10 el primer día y la edición corta

SELECT pg_temp.edition('E', pg_temp.draws(1, 2, 3, 4, 5), '2030-04-10', '2030-04-11', 8);
SELECT pg_temp.result(1, '2030-04-10', ARRAY['01','02','03','04','05','06','07','08','09','10']);
SELECT pg_temp.result(i, '2030-04-10', ARRAY[]::TEXT[]) FROM generate_series(2, 5) i;
SELECT pg_temp.result(1, '2030-04-11', ARRAY['11','12','13','14','15','16','17','18','19','20']);
SELECT pg_temp.result(i, '2030-04-11', ARRAY[]::TEXT[]) FROM generate_series(2, 5) i;
SELECT pg_temp.bet('E', 'R26-E1', ARRAY['01','02','03','04','05','06','07','08','09','10']);
SELECT pg_temp.bet('E', 'R26-E2', ARRAY['11','12','13','14','15','16','17','18','19','20']);
SELECT pg_temp.process('E', '2030-04-10');

SELECT is((pg_temp.edition_of('E')).winner_date, '2030-04-10'::DATE, 'con 10 el primer día, corta ahí');
SELECT is(
  (pg_temp.process('E', '2030-04-11'))->>'skipped',
  'true',
  'el día siguiente ya no se procesa'
);
SELECT is((pg_temp.bet_of('R26-E2')).winner, FALSE, 'el que hubiera completado 10 después no gana');

-- --------------- F: día incompleto, no define; "Definir con lo cargado"

SELECT pg_temp.edition('F', pg_temp.draws(1, 2, 3, 4, 5), '2030-04-12', '2030-04-12', 8);
SELECT pg_temp.result(1, '2030-04-12', ARRAY['01','02','03','04','05','06','07','08']);
SELECT pg_temp.result(2, '2030-04-12', ARRAY[]::TEXT[]);
SELECT pg_temp.result(3, '2030-04-12', ARRAY[]::TEXT[]);
SELECT pg_temp.bet('F', 'R26-F1', ARRAY['01','02','03','04','05','06','07','08','77','78']);

CREATE TEMP TABLE processed_f AS SELECT pg_temp.process('F', '2030-04-12') AS r;

SELECT is((pg_temp.bet_of('R26-F1')).hits, 8, 'los aciertos se marcan con los sorteos que hay');
SELECT is((pg_temp.bet_of('R26-F1')).winner, FALSE, 'pero sin todos los sorteos el día no define');
SELECT is((pg_temp.edition_of('F')).status, 'ACTIVE'::polla_edition_status_enum, 'la edición sigue en juego');
SELECT is((SELECT r->>'pending_date' FROM processed_f), '2030-04-12', 'avisa qué día espera');
SELECT is(
  (SELECT r->'missing_draws' FROM processed_f),
  jsonb_build_array(
    jsonb_build_object('polla_lottery_id', pg_temp.lot(4), 'polla_schedule_id', 'b0000000-0000-0000-0000-0000000026b1'),
    jsonb_build_object('polla_lottery_id', pg_temp.lot(5), 'polla_schedule_id', 'b0000000-0000-0000-0000-0000000026b1')
  ),
  'y qué sorteos faltan'
);

SELECT polla_define_edition_day(pg_temp.ed('F'), '2030-04-12', 'b0000000-0000-0000-0000-0000000026d1');

SELECT is((pg_temp.bet_of('R26-F1')).winner, TRUE, 'definido con lo cargado, gana el de 8');
SELECT is((pg_temp.edition_of('F')).status, 'FINISHED'::polla_edition_status_enum, 'y la edición termina');
SELECT is(
  (SELECT forced_by FROM polla_edition_forced_days WHERE polla_edition_id = pg_temp.ed('F')),
  'b0000000-0000-0000-0000-0000000026d1'::UUID,
  'queda guardado quién lo definió'
);
SELECT throws_ok(
  $$SELECT polla_define_edition_day(pg_temp.ed('F'), '2030-04-13', NULL)$$,
  'P0001',
  'POLLA_EDITION_DATE_OUT_OF_RANGE',
  'solo se define un día de la edición'
);

-- ----------------------- F10: un 10 con el día incompleto espera al resto

SELECT pg_temp.edition('F10', pg_temp.draws(1, 2, 3, 4, 5), '2030-04-14', '2030-04-14', 8);
SELECT pg_temp.result(1, '2030-04-14', ARRAY['01','02','03','04','05','06','07','08','09','10']);
SELECT pg_temp.bet('F10', 'R26-G1', ARRAY['01','02','03','04','05','06','07','08','09','10']);
SELECT pg_temp.bet('F10', 'R26-G2', ARRAY['11','12','13','14','15','16','17','18','19','20']);
SELECT pg_temp.process('F10', '2030-04-14');

SELECT is((pg_temp.bet_of('R26-G1')).winner, FALSE, 'un 10 con sorteos pendientes todavía no gana');

-- Con el resto de los sorteos, otro ticket también completa 10 ese día.
SELECT pg_temp.result(2, '2030-04-14', ARRAY['11','12','13','14','15']);
SELECT pg_temp.result(3, '2030-04-14', ARRAY['16','17','18','19','20']);
SELECT pg_temp.result(4, '2030-04-14', ARRAY[]::TEXT[]);
SELECT pg_temp.result(5, '2030-04-14', ARRAY[]::TEXT[]);
SELECT pg_temp.process('F10', '2030-04-14');

SELECT is((pg_temp.bet_of('R26-G1')).winner, TRUE, 'con el día completo gana');
SELECT is((pg_temp.bet_of('R26-G2')).winner, TRUE, 'junto con el que completó 10 con los otros sorteos');
SELECT is((pg_temp.bet_of('R26-G1')).prize, 500.00::NUMERIC(12,2), 'y reparten el pozo');

-- --------------------------------------------- R: la regular no cambia

SELECT pg_temp.edition('R10', pg_temp.draws(1), '2030-04-15', '2030-04-15', NULL);
SELECT pg_temp.edition('R9', pg_temp.draws(1), '2030-04-15', '2030-04-15', NULL);
SELECT pg_temp.result(1, '2030-04-15', ARRAY['01','02','03','04','05','06','07','08','09','10']);
SELECT pg_temp.bet('R10', 'R26-R1', ARRAY['01','02','03','04','05','06','07','08','09','10']);
SELECT pg_temp.bet('R10', 'R26-R2', ARRAY['01','02','03','04','05','06','07','08','09','77']);
SELECT pg_temp.bet('R9', 'R26-R3', ARRAY['01','02','03','04','05','06','07','08','09','77']);
SELECT pg_temp.process('R10', '2030-04-15');
SELECT pg_temp.process('R9', '2030-04-15');

SELECT is((pg_temp.bet_of('R26-R1')).winner, TRUE, 'regular: gana el que completa 10');
SELECT is((pg_temp.bet_of('R26-R2')).winner, FALSE, 'regular: el de 9 no gana');
SELECT is((pg_temp.bet_of('R26-R3')).winner, FALSE, 'regular sin nadie en 10: no hay escalera');
SELECT is((pg_temp.edition_of('R9')).status, 'FINISHED'::polla_edition_status_enum, 'regular: termina sin ganador');

-- ----------------------------------------------------- cambios de edición

SELECT throws_ok(
  format(
    $$SELECT polla_update_edition(%L, jsonb_build_object('draws', pg_temp.draws(1, 2)))$$,
    pg_temp.ed('F')
  ),
  'P0001',
  'POLLA_EDITION_HAS_WINNERS_LOCKED',
  'con ganador no se cambian los sorteos'
);
SELECT throws_ok(
  format(
    $$SELECT polla_update_edition(%L, '{"min_winning_hits": 9}')$$,
    pg_temp.ed('F10')
  ),
  'P0001',
  'POLLA_EDITION_HAS_WINNERS_LOCKED',
  'ni el mínimo de aciertos'
);

SELECT pg_temp.edition('Sin sorteos', pg_temp.draws(1, 2, 3), '2030-06-06', '2030-06-06', 8);
SELECT pg_temp.result(1, '2030-06-06', ARRAY[]::TEXT[]);

SELECT throws_ok(
  format(
    $$SELECT polla_update_edition(%L, jsonb_build_object('draws', pg_temp.draws(1, 2)))$$,
    pg_temp.ed('Sin sorteos')
  ),
  'P0001',
  'POLLA_EDITION_DRAWS_LOCKED',
  'con un resultado cargado no se cambian los sorteos'
);

DELETE FROM polla_results
WHERE polla_organization_id = 'b0000000-0000-0000-0000-000000000026' AND date = '2030-06-06';

SELECT is(
  (SELECT jsonb_array_length(
     polla_update_edition(pg_temp.ed('Sin sorteos'), jsonb_build_object(
       'draws', pg_temp.draws(2, 1),
       'min_winning_hits', 9
     ))->'draws')),
  2,
  'sin resultados se cambian los sorteos'
);
SELECT is((pg_temp.edition_of('Sin sorteos')).min_winning_hits, 9::SMALLINT, 'y el mínimo');
SELECT is((pg_temp.edition_of('Sin sorteos')).polla_lottery_id, pg_temp.lot(1), 'el principal se recalcula');

SELECT * FROM finish();
ROLLBACK;
