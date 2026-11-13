-- R33: un ticket se repite de cortesía una sola vez. Borrando la cortesía se
-- puede volver a repetir; una cortesía no se repite de cortesía; las
-- duplicadas de antes quedan; la repetición con cargo no cambia.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a4000000-0000-0000-0000-000000000033', 'pgTAP cortesía R33');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number)
VALUES ('a4000000-0000-0000-0000-0000000033e1', 'a4000000-0000-0000-0000-000000000033', 'Grupo R33', 1);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
VALUES ('a4000000-0000-0000-0000-0000000033c1', 'CASHIER', 'Pasador R33', 1,
        'a4000000-0000-0000-0000-000000000033', 'a4000000-0000-0000-0000-0000000033e1', 0, 0);

INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id, polla_group_id)
VALUES ('a4000000-0000-0000-0000-0000000033a1', 'ADMIN', 'Admin R33',
        'a4000000-0000-0000-0000-000000000033', 'a4000000-0000-0000-0000-0000000033e1');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a4000000-0000-0000-0000-0000000033b1', 'a4000000-0000-0000-0000-000000000033', 'Nacional R33');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a4000000-0000-0000-0000-0000000033b2', 'a4000000-0000-0000-0000-000000000033', 'Nocturna R33', '21:00');

CREATE FUNCTION pg_temp.edition() RETURNS UUID LANGUAGE sql AS $$
  SELECT (polla_create_edition(
    'a4000000-0000-0000-0000-000000000033',
    jsonb_build_object(
      'start_date', polla_today() + 10, 'end_date', polla_today() + 15,
      'load_limit_date', polla_today() + 9, 'load_limit_time', '20:00',
      'pool_amount', 1000, 'ticket_price', 100
    ),
    jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', 'a4000000-0000-0000-0000-0000000033b1',
      'polla_schedule_id', 'a4000000-0000-0000-0000-0000000033b2'))
  )->>'polla_edition_id')::UUID;
$$;

CREATE TEMP TABLE ed AS SELECT pg_temp.edition() AS origen, pg_temp.edition() AS destino, pg_temp.edition() AS otra;
CREATE TEMP TABLE t (name TEXT PRIMARY KEY, id UUID);

CREATE FUNCTION pg_temp.bet(p_name TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO t VALUES (p_name, (polla_create_bet(
    (SELECT origen FROM ed), 'a4000000-0000-0000-0000-0000000033c1', 'a4000000-0000-0000-0000-0000000033c1',
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    NULL, FALSE, FALSE, NULL, p_name, 'PAID'
  )->'bet'->>'polla_bet_id')::UUID);
END;
$$;

CREATE FUNCTION pg_temp.free_repeat(p_edition UUID, p_bet UUID) RETURNS JSONB LANGUAGE sql AS $$
  SELECT polla_repeat_bets('a4000000-0000-0000-0000-0000000033a1', p_edition, ARRAY[p_bet], TRUE);
$$;

CREATE FUNCTION pg_temp.id(p_name TEXT) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM t WHERE name = p_name;
$$;

SELECT pg_temp.bet('uno');
SELECT pg_temp.bet('viejo');
-- La edición de origen terminó: sus tickets se pueden repetir de cortesía.
UPDATE polla_editions SET status = 'FINISHED' WHERE polla_edition_id = (SELECT origen FROM ed);

-- ------------------------------------------------- una sola vez

CREATE TEMP TABLE r1 AS SELECT pg_temp.free_repeat((SELECT destino FROM ed), pg_temp.id('uno')) AS r;
SELECT is(jsonb_array_length((SELECT r->'created' FROM r1)), 1, 'la primera cortesía se carga');
INSERT INTO t SELECT 'cortesia1', ((r->'created'->0)->>'polla_bet_id')::UUID FROM r1;

CREATE TEMP TABLE r2 AS SELECT pg_temp.free_repeat((SELECT otra FROM ed), pg_temp.id('uno')) AS r;
SELECT is(jsonb_array_length((SELECT r->'created' FROM r2)), 0, 'la segunda no');
SELECT is((SELECT r->'skipped'->0->>'reason' FROM r2), 'POLLA_BET_ALREADY_COURTESY', 'porque ya tiene su cortesía');
SELECT is(
  (SELECT (r->'skipped'->0->'courtesy'->>'polla_edition_id')::UUID FROM r2),
  (SELECT destino FROM ed),
  'y dice en qué edición está'
);
SELECT is(
  (SELECT r->'skipped'->0->'courtesy'->>'ticket_number' FROM r2),
  (SELECT ticket_number FROM polla_bets WHERE polla_bet_id = pg_temp.id('cortesia1')),
  'y con qué ticket'
);
SELECT is(
  (polla_bet_courtesy(pg_temp.id('uno'))->>'polla_bet_id')::UUID,
  pg_temp.id('cortesia1'),
  'polla_bet_courtesy devuelve la cortesía vigente'
);

-- El trigger frena cualquier otro camino.
SELECT throws_ok(
  $$SELECT polla_create_bet(
      (SELECT otra FROM ed), 'a4000000-0000-0000-0000-0000000033a1', 'a4000000-0000-0000-0000-0000000033c1',
      ARRAY['01','02','03','04','05','06','07','08','09','10'],
      NULL, FALSE, TRUE, pg_temp.id('uno'), 'uno', NULL)$$,
  'P0001', 'POLLA_BET_ALREADY_COURTESY',
  'el trigger no deja crear otra cortesía por fuera de la repetición'
);

-- ---------------------------------------- borrarla y volver a repetir

UPDATE polla_bets SET deleted_at = NOW() WHERE polla_bet_id = pg_temp.id('cortesia1');
CREATE TEMP TABLE r3 AS SELECT pg_temp.free_repeat((SELECT otra FROM ed), pg_temp.id('uno')) AS r;
SELECT is(jsonb_array_length((SELECT r->'created' FROM r3)), 1, 'borrada la cortesía, se repite en la edición correcta');
SELECT is(
  ((SELECT r->'created'->0 FROM r3)->>'polla_edition_id')::UUID,
  (SELECT otra FROM ed),
  'queda en la edición elegida'
);
INSERT INTO t SELECT 'cortesia2', ((r->'created'->0)->>'polla_bet_id')::UUID FROM r3;

-- -------------------------------------- una cortesía no se repite de cortesía

UPDATE polla_editions SET status = 'FINISHED' WHERE polla_edition_id = (SELECT otra FROM ed);
CREATE TEMP TABLE r4 AS SELECT pg_temp.free_repeat((SELECT destino FROM ed), pg_temp.id('cortesia2')) AS r;
SELECT is((SELECT r->'skipped'->0->>'reason' FROM r4), 'POLLA_FREE_REPEAT_OF_COURTESY', 'una cortesía no se repite de cortesía');
UPDATE polla_editions SET status = 'ACTIVE' WHERE polla_edition_id = (SELECT otra FROM ed);

-- ------------------------------------------- las duplicadas de antes

-- Antes de R33 un ticket podía tener dos cortesías: quedan como están.
ALTER TABLE polla_bets DISABLE TRIGGER trg_polla_free_repeat_once;
SELECT polla_create_bet(
  (SELECT destino FROM ed), 'a4000000-0000-0000-0000-0000000033a1', 'a4000000-0000-0000-0000-0000000033c1',
  ARRAY['01','02','03','04','05','06','07','08','09','10'], NULL, FALSE, TRUE, pg_temp.id('viejo'), 'viejo', NULL);
SELECT polla_create_bet(
  (SELECT otra FROM ed), 'a4000000-0000-0000-0000-0000000033a1', 'a4000000-0000-0000-0000-0000000033c1',
  ARRAY['01','02','03','04','05','06','07','08','09','10'], NULL, FALSE, TRUE, pg_temp.id('viejo'), 'viejo', NULL);
ALTER TABLE polla_bets ENABLE TRIGGER trg_polla_free_repeat_once;

SELECT is(
  (SELECT COUNT(*)::INT FROM polla_bets
   WHERE repeated_from_bet_id = pg_temp.id('viejo') AND is_free AND deleted_at IS NULL),
  2,
  'las dos cortesías viejas siguen'
);
CREATE TEMP TABLE r5 AS SELECT pg_temp.free_repeat((SELECT destino FROM ed), pg_temp.id('viejo')) AS r;
SELECT is((SELECT r->'skipped'->0->>'reason' FROM r5), 'POLLA_BET_ALREADY_COURTESY', 'pero no suman una tercera');

-- ------------------------------------------- con cargo, como siempre

CREATE TEMP TABLE r6 AS
SELECT polla_repeat_bets('a4000000-0000-0000-0000-0000000033a1', (SELECT destino FROM ed), ARRAY[pg_temp.id('uno')], FALSE, 'PAID') AS r;
SELECT is(jsonb_array_length((SELECT r->'created' FROM r6)), 1, 'repetir con cargo un ticket con cortesía sigue andando');
SELECT is(((SELECT r->'created'->0 FROM r6)->>'is_free')::BOOLEAN, FALSE, 'y no es cortesía');

SELECT * FROM finish();
ROLLBACK;
