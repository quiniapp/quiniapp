-- R25: "Ventas del día" muestra el total de la edición. El total
-- (`polla_daily_sales` con la edición sola) coincide con la suma de los días
-- (la misma edición, día por día), en total, por grupo y por pasador. Ni lo
-- repetido sin cargo, ni lo borrado, ni lo de otra edición entra.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(8);

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('a3000000-0000-0000-0000-000000000025', 'pgTAP ventas R25');

INSERT INTO polla_groups (polla_group_id, polla_organization_id, name, number) VALUES
  ('a3000000-0000-0000-0000-0000000025e1', 'a3000000-0000-0000-0000-000000000025', 'Grupo uno', 1),
  ('a3000000-0000-0000-0000-0000000025e2', 'a3000000-0000-0000-0000-000000000025', 'Grupo dos', 2);

INSERT INTO polla_users (polla_user_id, user_type, name, number, polla_organization_id, polla_group_id, fee, fee_plus) VALUES
  ('a3000000-0000-0000-0000-0000000025c1', 'CASHIER', 'Pasador uno', 1,
   'a3000000-0000-0000-0000-000000000025', 'a3000000-0000-0000-0000-0000000025e1', 0, 0),
  ('a3000000-0000-0000-0000-0000000025c2', 'CASHIER', 'Pasador dos', 1,
   'a3000000-0000-0000-0000-000000000025', 'a3000000-0000-0000-0000-0000000025e2', 0, 0);

INSERT INTO polla_users (polla_user_id, user_type, name, polla_organization_id)
VALUES ('a3000000-0000-0000-0000-0000000025a1', 'SUPERADMIN', 'Superadmin R25',
        'a3000000-0000-0000-0000-000000000025');

INSERT INTO polla_lotteries (polla_lottery_id, polla_organization_id, name)
VALUES ('a3000000-0000-0000-0000-0000000025b1', 'a3000000-0000-0000-0000-000000000025', 'Nacional R25');
INSERT INTO polla_schedules (polla_schedule_id, polla_organization_id, name, time)
VALUES ('a3000000-0000-0000-0000-0000000025b2', 'a3000000-0000-0000-0000-000000000025', 'Nocturna R25', '21:00');

CREATE FUNCTION pg_temp.edition(p_price NUMERIC) RETURNS UUID LANGUAGE sql AS $$
  SELECT (polla_create_edition(
    'a3000000-0000-0000-0000-000000000025',
    jsonb_build_object(
      'start_date', polla_today() + 10, 'end_date', polla_today() + 15,
      'load_limit_date', polla_today() + 9, 'load_limit_time', '20:00',
      'pool_amount', 1000, 'ticket_price', p_price
    ),
    jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', 'a3000000-0000-0000-0000-0000000025b1',
      'polla_schedule_id', 'a3000000-0000-0000-0000-0000000025b2'))
  )->>'polla_edition_id')::UUID;
$$;

-- Dos ediciones que se superponen (R27): la regular y la especial.
CREATE TEMP TABLE ed AS SELECT pg_temp.edition(100) AS regular, pg_temp.edition(70) AS especial;

-- Un ticket cargado por el pasador y movido al día de carga que se quiera.
CREATE FUNCTION pg_temp.bet(p_edition UUID, p_cashier UUID, p_load_offset INTEGER, p_free BOOLEAN DEFAULT FALSE)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := (polla_create_bet(
    p_edition,
    CASE WHEN p_free THEN 'a3000000-0000-0000-0000-0000000025a1'::UUID ELSE p_cashier END,
    p_cashier,
    ARRAY['01','02','03','04','05','06','07','08','09','10'],
    NULL, FALSE, p_free, NULL, 'cliente', 'PAID'
  )->'bet'->>'polla_bet_id')::UUID;
  UPDATE polla_bets SET load_date = polla_today() + p_load_offset WHERE polla_bet_id = v_id;
  RETURN v_id;
END;
$$;

-- Regular: 3 días de carga, los dos grupos.
SELECT pg_temp.bet((SELECT regular FROM ed), 'a3000000-0000-0000-0000-0000000025c1', -2);
SELECT pg_temp.bet((SELECT regular FROM ed), 'a3000000-0000-0000-0000-0000000025c1', -2);
SELECT pg_temp.bet((SELECT regular FROM ed), 'a3000000-0000-0000-0000-0000000025c2', -1);
SELECT pg_temp.bet((SELECT regular FROM ed), 'a3000000-0000-0000-0000-0000000025c1', 0);
SELECT pg_temp.bet((SELECT regular FROM ed), 'a3000000-0000-0000-0000-0000000025c2', 0);
-- Lo que no tiene que contar: una repetida sin cargo, una borrada y la especial.
SELECT pg_temp.bet((SELECT regular FROM ed), 'a3000000-0000-0000-0000-0000000025c1', -1, TRUE);
CREATE TEMP TABLE borrada AS
SELECT pg_temp.bet((SELECT regular FROM ed), 'a3000000-0000-0000-0000-0000000025c2', -1) AS id;
UPDATE polla_bets SET deleted_at = NOW() WHERE polla_bet_id = (SELECT id FROM borrada);
SELECT pg_temp.bet((SELECT especial FROM ed), 'a3000000-0000-0000-0000-0000000025c1', -1);
SELECT pg_temp.bet((SELECT especial FROM ed), 'a3000000-0000-0000-0000-0000000025c2', 0);

-- Total de la edición y suma de sus días (de 3 días antes a hoy), por grupo.
CREATE TEMP TABLE total AS
SELECT * FROM polla_daily_sales('a3000000-0000-0000-0000-000000000025', NULL, NULL, NULL, (SELECT regular FROM ed));

CREATE TEMP TABLE days AS
SELECT s.*
FROM generate_series(polla_today() - 3, polla_today(), INTERVAL '1 day') AS d(day)
CROSS JOIN LATERAL polla_daily_sales(
  'a3000000-0000-0000-0000-000000000025', d.day::DATE, NULL, NULL, (SELECT regular FROM ed)
) s;

SELECT is((SELECT SUM(amount) FROM total), 500::NUMERIC, 'el total de la edición son sus 5 tickets con cargo vigentes');
SELECT is((SELECT SUM(bets_count) FROM total), 5::NUMERIC, 'sin la repetida sin cargo ni la borrada');
SELECT is(
  (SELECT SUM(amount) FROM days), (SELECT SUM(amount) FROM total),
  'la suma de los días da el total de la edición'
);
SELECT is(
  (SELECT SUM(bets_count) FROM days), (SELECT SUM(bets_count) FROM total),
  'también en cantidad de tickets'
);
SELECT set_eq(
  $$SELECT polla_group_id, SUM(amount) FROM days GROUP BY polla_group_id$$,
  $$SELECT polla_group_id, SUM(amount) FROM total GROUP BY polla_group_id$$,
  'y grupo por grupo'
);
SELECT is(
  (
    SELECT SUM(s.amount)
    FROM generate_series(polla_today() - 3, polla_today(), INTERVAL '1 day') AS d(day)
    CROSS JOIN LATERAL polla_daily_sales(
      'a3000000-0000-0000-0000-000000000025', d.day::DATE,
      'a3000000-0000-0000-0000-0000000025c1', NULL, (SELECT regular FROM ed)
    ) s
  ),
  (
    SELECT SUM(amount) FROM polla_daily_sales(
      'a3000000-0000-0000-0000-000000000025', NULL,
      'a3000000-0000-0000-0000-0000000025c1', NULL, (SELECT regular FROM ed)
    )
  ),
  'y para un pasador'
);
SELECT is(
  (SELECT SUM(amount) FROM polla_daily_sales(
    'a3000000-0000-0000-0000-000000000025', NULL, NULL, NULL, (SELECT especial FROM ed))),
  140::NUMERIC,
  'la otra edición tiene su propio total'
);
SELECT is(
  (SELECT SUM(amount) FROM polla_daily_sales(
    'a3000000-0000-0000-0000-000000000025', polla_today(), NULL, NULL, NULL)),
  270::NUMERIC,
  'el día sin edición suma todas las ediciones de ese día'
);

SELECT * FROM finish();
ROLLBACK;
