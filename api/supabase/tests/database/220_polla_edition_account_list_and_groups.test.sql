-- Pendientes de la cuenta por edición (20261115204744, 205500, 205800, 210000):
-- lista con filtros, páginas y contadores; pasador eliminado que sigue en lo
-- histórico; todos los grupos en una consulta; movimientos solo con la carga
-- cerrada.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(24);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-000000000220', 'pgTAP lista y grupos');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number) VALUES
  ('a9000000-0000-0000-0000-00000220e001', 'a9000000-0000-0000-0000-000000000220', 'Grupo A 220', 1),
  ('a9000000-0000-0000-0000-00000220e002', 'a9000000-0000-0000-0000-000000000220', 'Grupo B 220', 2);

-- 1, 2, 4 y 5 en el grupo A; 3 en el B. El 4 queda en cero; el 5, sin liquidar.
INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus)
SELECT ('a9000000-0000-0000-0000-00000220c00' || n)::UUID, 'CASHIER', 'Pasador ' || n, n,
       'a9000000-0000-0000-0000-000000000220',
       CASE WHEN n = 3 THEN 'a9000000-0000-0000-0000-00000220e002' ELSE 'a9000000-0000-0000-0000-00000220e001' END::UUID,
       10, 0
FROM generate_series(1, 5) n;
INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a9000000-0000-0000-0000-00000220d001', 'OWNER', 'Dueño 220', 'a9000000-0000-0000-0000-000000000220');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a9000000-0000-0000-0000-00000220a001', 'a9000000-0000-0000-0000-000000000220', 'Nacional 220');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a9000000-0000-0000-0000-00000220b001', 'a9000000-0000-0000-0000-000000000220', 'Nocturna 220', '21:00');

CREATE TEMP TABLE eds (name TEXT PRIMARY KEY, id UUID NOT NULL);

-- p_start: días desde hoy al inicio; con la carga cerrada si p_past.
CREATE FUNCTION pg_temp.edition(p_name TEXT, p_start INTEGER, p_past BOOLEAN) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := (polla_create_edition(
    'a9000000-0000-0000-0000-000000000220',
    jsonb_build_object(
      'name', p_name, 'start_date', polla_today() + 1, 'end_date', polla_today() + 5,
      'load_limit_date', polla_today() + 1, 'load_limit_time', '20:00',
      'pool_amount', 1000, 'ticket_price', 100
    ),
    jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', 'a9000000-0000-0000-0000-00000220a001',
      'polla_schedule_id', 'a9000000-0000-0000-0000-00000220b001'))
  )->>'polla_edition_id')::UUID;
  IF p_past THEN
    UPDATE polla_editions
    SET load_start_date = polla_today() + p_start - 10, load_limit_date = polla_today() + p_start - 2,
        start_date = polla_today() + p_start, end_date = polla_today() + 5
    WHERE polla_edition_id = v_id;
  END IF;
  INSERT INTO eds VALUES (p_name, v_id);
END;
$$;

CREATE FUNCTION pg_temp.ed(p_name TEXT) RETURNS UUID LANGUAGE sql AS $$
  SELECT id FROM eds WHERE name = p_name;
$$;

CREATE FUNCTION pg_temp.cashier(p_n INTEGER) RETURNS UUID LANGUAGE sql AS $$
  SELECT ('a9000000-0000-0000-0000-00000220c00' || p_n)::UUID;
$$;

CREATE FUNCTION pg_temp.bet(p_edition TEXT, p_cashier INTEGER, p_ticket TEXT) RETURNS VOID
LANGUAGE sql AS $$
  INSERT INTO polla_bets (
    ticket_number, polla_edition_id, polla_user_id, cashier_polla_user_id, polla_organization_id,
    user_name, cashier_name, cashier_number, load_date, amount, numbers
  ) VALUES (
    p_ticket, pg_temp.ed(p_edition), pg_temp.cashier(p_cashier), pg_temp.cashier(p_cashier),
    'a9000000-0000-0000-0000-000000000220', 'Pasador ' || p_cashier, 'Pasador ' || p_cashier, p_cashier,
    polla_today() - 20, 100, ARRAY['01','02','03','04','05','06','07','08','09','10']
  );
$$;

CREATE FUNCTION pg_temp.list(p_liquidated BOOLEAN DEFAULT NULL, p_from DATE DEFAULT NULL, p_to DATE DEFAULT NULL,
                             p_counts BOOLEAN DEFAULT TRUE, p_limit INTEGER DEFAULT NULL, p_offset INTEGER DEFAULT 0)
RETURNS SETOF JSONB LANGUAGE sql AS $$
  SELECT * FROM polla_edition_account_list('a9000000-0000-0000-0000-000000000220',
    p_liquidated, p_from, p_to, p_counts, p_limit, p_offset);
$$;

CREATE FUNCTION pg_temp.item(p_edition TEXT) RETURNS JSONB LANGUAGE sql AS $$
  SELECT j FROM pg_temp.list() j WHERE (j->>'polla_edition_id')::UUID = pg_temp.ed(p_edition);
$$;

-- "nueva" empieza hace 10 días; "vieja", hace 15; "abierta" tiene la carga abierta.
SELECT pg_temp.edition('nueva', -10, TRUE);
SELECT pg_temp.edition('vieja', -15, TRUE);
SELECT pg_temp.edition('abierta', 0, FALSE);

-- En "nueva": el 1 debe 180 (200 − 10%); al 2 hay que pagarle 310 (90 − cobro de 400).
SELECT pg_temp.bet('nueva', 1, 'N-1');
SELECT pg_temp.bet('nueva', 1, 'N-2');
SELECT pg_temp.bet('nueva', 2, 'N-3');
SELECT polla_generate_edition_liquidation('a9000000-0000-0000-0000-000000000220', pg_temp.ed('nueva'),
  'a9000000-0000-0000-0000-00000220d001',
  jsonb_build_array(
    jsonb_build_object('polla_user_id', pg_temp.cashier(1)),
    jsonb_build_object('polla_user_id', pg_temp.cashier(2), 'collection', 400),
    jsonb_build_object('polla_user_id', pg_temp.cashier(4))));

-- ------------------------------------------------------------ la lista

SELECT is(pg_temp.item('nueva')->>'cashiers_count', '2', 'cuenta a los que tienen movimiento');
SELECT is(pg_temp.item('nueva')->>'liquidated_count', '2',
  'el liquidado en cero no suma a los liquidados (antes daba 3 de 2)');
SELECT is((pg_temp.item('nueva')->>'owed_by_cashiers')::NUMERIC, 180::NUMERIC, 'lo que deben los pasadores');
SELECT is((pg_temp.item('nueva')->>'owed_to_cashiers')::NUMERIC, 310::NUMERIC,
  'y lo que hay que pagarles, sin compensar');
SELECT is((SELECT array_agg(j->>'polla_edition_id') FROM pg_temp.list(TRUE) j),
  ARRAY[pg_temp.ed('nueva')::TEXT], 'liquidaciones realizadas: solo las marcadas');
SELECT is((SELECT array_agg(j->>'polla_edition_id') FROM pg_temp.list(FALSE) j),
  ARRAY[pg_temp.ed('vieja')::TEXT], 'a liquidar: las demás con la carga cerrada (no la abierta)');
SELECT is((SELECT array_agg(j->>'polla_edition_id') FROM pg_temp.list() j),
  ARRAY[pg_temp.ed('nueva')::TEXT, pg_temp.ed('vieja')::TEXT], 'todas, de la más nueva a la más vieja');
SELECT is((SELECT array_agg(j->>'polla_edition_id') FROM pg_temp.list(p_limit => 1, p_offset => 1) j),
  ARRAY[pg_temp.ed('vieja')::TEXT], 'de a páginas');
SELECT is((SELECT j->>'total_count' FROM pg_temp.list(p_limit => 1) j), '2',
  'cada página dice cuántas hay en total');
SELECT is((SELECT array_agg(j->>'polla_edition_id')
           FROM pg_temp.list(p_from => polla_today() - 16, p_to => polla_today() - 14) j),
  ARRAY[pg_temp.ed('vieja')::TEXT], 'por rango de inicio');
SELECT ok((SELECT bool_and(j->'cashiers_count' = 'null'::JSONB AND j->'owed_by_cashiers' = 'null'::JSONB)
           FROM pg_temp.list(p_counts => FALSE) j),
  'sin contadores no calcula la cuenta');
SELECT is((SELECT count(*) FROM polla_edition_account_list('a9000000-0000-0000-0000-000000000220')),
  2::BIGINT, 'con solo la organización sigue andando');

-- ---------------------------------------- pasador eliminado con liquidación

SELECT pg_temp.bet('nueva', 3, 'N-4');
SELECT polla_liquidate_edition_accounts('a9000000-0000-0000-0000-000000000220', pg_temp.ed('nueva'),
  ARRAY[pg_temp.cashier(3)], 'a9000000-0000-0000-0000-00000220d001');
-- Se le borra el ticket (sin descontar) y se lo elimina.
UPDATE polla_bets SET deleted_at = NOW() WHERE ticket_number = 'N-4';
UPDATE polla_users SET deleted_at = NOW() WHERE polla_user_id = pg_temp.cashier(3);

SELECT is(
  (SELECT count(*) FROM polla_edition_account_base('a9000000-0000-0000-0000-000000000220', pg_temp.ed('nueva')) b
   WHERE b.polla_user_id = pg_temp.cashier(3) AND b.liquidation_id IS NOT NULL),
  1::BIGINT, 'el pasador eliminado sigue en la cuenta con su liquidación');
SELECT is(
  (SELECT count(*) FROM polla_edition_account_base('a9000000-0000-0000-0000-000000000220', pg_temp.ed('vieja')) b
   WHERE b.polla_user_id = pg_temp.cashier(3)),
  0::BIGINT, 'pero no aparece en una edición donde no tuvo nada');

-- ---------------------------------------------------------- grupos juntos

INSERT INTO polla_org_expenses (polla_organization_id, polla_group_id, date, name, amount, polla_edition_id)
VALUES ('a9000000-0000-0000-0000-000000000220', 'a9000000-0000-0000-0000-00000220e001', polla_today(), 'Gasto A', 15,
        pg_temp.ed('nueva'));
-- Un pasador del grupo A con jugadas y sin liquidar.
SELECT pg_temp.bet('nueva', 5, 'N-5');

CREATE TEMP TABLE previews AS
SELECT j FROM polla_group_edition_account_previews('a9000000-0000-0000-0000-000000000220', pg_temp.ed('nueva')) j;

SELECT is((SELECT count(*) FROM previews), 2::BIGINT, 'trae todos los grupos');
SELECT is((SELECT array_agg(j->>'group_name') FROM previews), ARRAY['Grupo A 220', 'Grupo B 220'],
  'ordenados por nombre');
SELECT is(
  (SELECT count(*) FROM previews p
   WHERE p.j <> polla_group_edition_account_preview('a9000000-0000-0000-0000-000000000220',
                  (p.j->>'polla_group_id')::UUID, pg_temp.ed('nueva'))),
  0::BIGINT, 'cada grupo da lo mismo que pedido de a uno');
SELECT is(
  (SELECT jsonb_array_length(j->'pending_cashiers') FROM previews WHERE j->>'group_name' = 'Grupo A 220'),
  1, 'con su pasador pendiente');
SELECT is((SELECT (j->>'base')::NUMERIC FROM previews WHERE j->>'group_name' = 'Grupo A 220'),
  (180 + 90 - 15)::NUMERIC, 'y su base: subtotales liquidados menos los gastos (los cobros no cuentan)');
SELECT throws_ok(
  $$SELECT * FROM polla_group_edition_account_previews('a9000000-0000-0000-0000-000000000220',
      '00000000-0000-0000-0000-000000000000')$$,
  'P0001', 'POLLA_EDITION_NOT_FOUND', 'una edición que no existe');

-- ---------------------------------------- movimientos y cierre de carga

SELECT throws_ok(
  $$INSERT INTO polla_edition_account_movements (polla_organization_id, polla_edition_id, polla_user_id, type, amount)
    VALUES ('a9000000-0000-0000-0000-000000000220', pg_temp.ed('abierta'), pg_temp.cashier(1), 'COLLECTION', 50)$$,
  'P0001', 'POLLA_EDITION_LOAD_OPEN', 'con la carga abierta no se cargan movimientos');
SELECT lives_ok(
  $$INSERT INTO polla_edition_account_movements (polla_organization_id, polla_edition_id, polla_user_id, type, amount, note)
    VALUES ('a9000000-0000-0000-0000-000000000220', pg_temp.ed('vieja'), pg_temp.cashier(1), 'COLLECTION', 50, 'm220')$$,
  'con la carga cerrada sí');

-- Si la carga se vuelve a abrir (se extiende la edición), editar no; dar de baja sí.
UPDATE polla_editions
SET start_date = polla_today() + 3, end_date = polla_today() + 8, load_limit_date = polla_today() + 1
WHERE polla_edition_id = pg_temp.ed('vieja');
SELECT throws_ok(
  $$UPDATE polla_edition_account_movements SET amount = 60 WHERE note = 'm220'$$,
  'P0001', 'POLLA_EDITION_LOAD_OPEN', 'con la carga abierta no se edita');
SELECT lives_ok(
  $$UPDATE polla_edition_account_movements SET deleted_at = NOW() WHERE note = 'm220'$$,
  'pero se da de baja');

SELECT * FROM finish();
ROLLBACK;
