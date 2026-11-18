-- generate_winners solo reescribe las filas que cambian
-- (migración 20261118054824_perf_generate_winners_skip_unchanged).
-- Cubre: premios y aciertos por jugada, totales del ticket sumando turnos,
-- conteos del JSON, re-run sin reescrituras (ctid igual) y cambio de
-- resultados que da vuelta ganadoras.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(19);

-- Fixture: una organización, dos turnos, una quiniela, dos tickets.
INSERT INTO organizations (organization_id, name)
VALUES ('b2600000-0000-4000-8000-000000000001', 'pgTAP generate_winners');

INSERT INTO schedules (schedule_id, name, time, organization_id)
VALUES ('b2600000-0000-4000-8000-0000000005a1', 'Turno 1 260', '10:00', 'b2600000-0000-4000-8000-000000000001'),
       ('b2600000-0000-4000-8000-0000000005a2', 'Turno 2 260', '15:00', 'b2600000-0000-4000-8000-000000000001');

INSERT INTO lotteries (lottery_id, name, organization_id)
VALUES ('b2600000-0000-4000-8000-00000000011a', 'Quiniela 260', 'b2600000-0000-4000-8000-000000000001');

INSERT INTO tickets (ticket_id, user_name, ticket_number, date, total, organization_id)
VALUES ('b2600000-0000-4000-8000-0000000000f1', 'Pasador 260', '300001150000000001-1', '2030-01-15', 210, 'b2600000-0000-4000-8000-000000000001'),
       ('b2600000-0000-4000-8000-0000000000f2', 'Pasador 260', '300001150000000002-1', '2030-01-15', 50, 'b2600000-0000-4000-8000-000000000001');

-- A la cabeza paga 7 veces lo apostado si el primer premio termina en el número.
--   b1 (t1, turno 1) '12' x 100 → gana con 0012
--   b2 (t1, turno 1) '34' x 100 → pierde
--   b3 (t2, turno 1) '56' x 50  → pierde
--   b4 (t1, turno 2) '99' x 10  → gana con 1099
INSERT INTO bets (bet_id, bet_type, ticket_id, number, amount, place, date, organization_id,
                  lottery_id, schedule_id, ticket_number, cashier_name, bet_order)
VALUES
  ('b2600000-0000-4000-8000-0000000000b1', 'ONE', 'b2600000-0000-4000-8000-0000000000f1', '12', 100, 'HEAD', '2030-01-15',
   'b2600000-0000-4000-8000-000000000001', 'b2600000-0000-4000-8000-00000000011a', 'b2600000-0000-4000-8000-0000000005a1', '300001150000000001-1', 'Pasador 260', 1),
  ('b2600000-0000-4000-8000-0000000000b2', 'ONE', 'b2600000-0000-4000-8000-0000000000f1', '34', 100, 'HEAD', '2030-01-15',
   'b2600000-0000-4000-8000-000000000001', 'b2600000-0000-4000-8000-00000000011a', 'b2600000-0000-4000-8000-0000000005a1', '300001150000000001-1', 'Pasador 260', 2),
  ('b2600000-0000-4000-8000-0000000000b3', 'ONE', 'b2600000-0000-4000-8000-0000000000f2', '56', 50, 'HEAD', '2030-01-15',
   'b2600000-0000-4000-8000-000000000001', 'b2600000-0000-4000-8000-00000000011a', 'b2600000-0000-4000-8000-0000000005a1', '300001150000000002-1', 'Pasador 260', 1),
  ('b2600000-0000-4000-8000-0000000000b4', 'ONE', 'b2600000-0000-4000-8000-0000000000f1', '99', 10, 'HEAD', '2030-01-15',
   'b2600000-0000-4000-8000-000000000001', 'b2600000-0000-4000-8000-00000000011a', 'b2600000-0000-4000-8000-0000000005a2', '300001150000000001-1', 'Pasador 260', 3);

INSERT INTO results (results_id, date, lottery_id, schedule_id, organization_id, results)
VALUES ('b2600000-0000-4000-8000-0000000000e1', '2030-01-15', 'b2600000-0000-4000-8000-00000000011a',
        'b2600000-0000-4000-8000-0000000005a1', 'b2600000-0000-4000-8000-000000000001',
        ARRAY['0012','1111','2222','3333','4444','5555','6666','7777','8888','9999',
              '1010','2020','3030','4040','5050','6060','7070','8080','9090','0101']),
       ('b2600000-0000-4000-8000-0000000000e2', '2030-01-15', 'b2600000-0000-4000-8000-00000000011a',
        'b2600000-0000-4000-8000-0000000005a2', 'b2600000-0000-4000-8000-000000000001',
        ARRAY['1099','1111','2222','3333','4444','5555','6666','7777','8888','9999',
              '1010','2020','3030','4040','5050','6060','7070','8080','9090','0101']);

CREATE TEMP TABLE gw_ret (n INT, r JSONB);

-- 1. Turno 1
INSERT INTO gw_ret SELECT 1, generate_winners('b2600000-0000-4000-8000-0000000005a1', '2030-01-15', 'b2600000-0000-4000-8000-000000000001');

SELECT is((SELECT (prize, hits, winner)::TEXT FROM bets WHERE bet_id = 'b2600000-0000-4000-8000-0000000000b1'),
          '(700.00,1,t)', 'turno 1: la jugada que acierta cobra 7x y queda ganadora');
SELECT is((SELECT count(*) FROM bets WHERE bet_id IN ('b2600000-0000-4000-8000-0000000000b2', 'b2600000-0000-4000-8000-0000000000b3')
             AND prize = 0 AND hits = 0 AND NOT winner),
          2::BIGINT, 'turno 1: las que no aciertan quedan en 0');
SELECT is((SELECT (total_prize, hits, winner)::TEXT FROM tickets WHERE ticket_id = 'b2600000-0000-4000-8000-0000000000f1'),
          '(700.00,1,t)', 'turno 1: el ticket suma el premio del turno');
SELECT is((SELECT (total_prize, winner)::TEXT FROM tickets WHERE ticket_id = 'b2600000-0000-4000-8000-0000000000f2'),
          '(0.00,f)', 'turno 1: el ticket sin aciertos queda en 0');
SELECT is((SELECT r - 'schedule_id' - 'date' FROM gw_ret WHERE n = 1),
          '{"success": true, "affected_tickets": 2, "winner_tickets": 1}'::JSONB,
          'turno 1: el JSON cuenta todos los tickets del turno');

-- 2. Turno 2: el ticket 1 acumula los dos turnos.
SELECT lives_ok($$SELECT generate_winners('b2600000-0000-4000-8000-0000000005a2', '2030-01-15', 'b2600000-0000-4000-8000-000000000001')$$,
                'turno 2 corre');
SELECT is((SELECT (prize, winner)::TEXT FROM bets WHERE bet_id = 'b2600000-0000-4000-8000-0000000000b4'),
          '(70.00,t)', 'turno 2: gana la jugada del turno 2');
SELECT is((SELECT (total_prize, hits)::TEXT FROM tickets WHERE ticket_id = 'b2600000-0000-4000-8000-0000000000f1'),
          '(770.00,2)', 'turno 2: el ticket suma los dos turnos');
SELECT is((SELECT count(*) FROM ticket_prizes_by_turn WHERE ticket_id = 'b2600000-0000-4000-8000-0000000000f1'),
          2::BIGINT, 'ticket_prizes_by_turn: una fila por turno');

-- 3. Re-run del turno 1 con los mismos resultados: no reescribe ninguna fila
--    (un UPDATE crea una versión nueva de la fila, con otro ctid).
CREATE TEMP TABLE ctid_before AS
SELECT 'bet' AS k, bet_id AS id, ctid::TEXT AS c FROM bets WHERE organization_id = 'b2600000-0000-4000-8000-000000000001'
UNION ALL
SELECT 'ticket', ticket_id, ctid::TEXT FROM tickets WHERE organization_id = 'b2600000-0000-4000-8000-000000000001';

INSERT INTO gw_ret SELECT 3, generate_winners('b2600000-0000-4000-8000-0000000005a1', '2030-01-15', 'b2600000-0000-4000-8000-000000000001');

SELECT is((SELECT count(*) FROM bets b JOIN ctid_before x ON x.k = 'bet' AND x.id = b.bet_id WHERE b.ctid::TEXT <> x.c),
          0::BIGINT, 're-run: no reescribe jugadas sin cambios');
SELECT is((SELECT count(*) FROM tickets t JOIN ctid_before x ON x.k = 'ticket' AND x.id = t.ticket_id WHERE t.ctid::TEXT <> x.c),
          0::BIGINT, 're-run: no reescribe tickets sin cambios');
SELECT is((SELECT r FROM gw_ret WHERE n = 3), (SELECT r FROM gw_ret WHERE n = 1),
          're-run: devuelve lo mismo que la primera corrida');
SELECT is((SELECT (total_prize, hits)::TEXT FROM tickets WHERE ticket_id = 'b2600000-0000-4000-8000-0000000000f1'),
          '(770.00,2)', 're-run: el total del ticket no cambia');

-- 4. Se corrige el resultado del turno 1: ahora gana b3 (ticket 2) y pierde b1.
UPDATE results SET results[1] = '0056' WHERE results_id = 'b2600000-0000-4000-8000-0000000000e1';
SELECT generate_winners('b2600000-0000-4000-8000-0000000005a1', '2030-01-15', 'b2600000-0000-4000-8000-000000000001');

SELECT is((SELECT (prize, hits, winner)::TEXT FROM bets WHERE bet_id = 'b2600000-0000-4000-8000-0000000000b1'),
          '(0.00,0,f)', 'resultado corregido: la que ganaba deja de ganar');
SELECT is((SELECT (prize, winner)::TEXT FROM bets WHERE bet_id = 'b2600000-0000-4000-8000-0000000000b3'),
          '(350.00,t)', 'resultado corregido: la nueva ganadora cobra');
SELECT is((SELECT (total_prize, hits, winner)::TEXT FROM tickets WHERE ticket_id = 'b2600000-0000-4000-8000-0000000000f1'),
          '(70.00,1,t)', 'resultado corregido: el ticket 1 queda con el turno 2');
SELECT is((SELECT (total_prize, winner)::TEXT FROM tickets WHERE ticket_id = 'b2600000-0000-4000-8000-0000000000f2'),
          '(350.00,t)', 'resultado corregido: el ticket 2 pasa a ganador');
SELECT is((SELECT count(*) FROM bets b JOIN ctid_before x ON x.k = 'bet' AND x.id = b.bet_id
             WHERE b.ctid::TEXT <> x.c),
          2::BIGINT, 'resultado corregido: solo se reescriben las dos jugadas que cambian');
SELECT is((SELECT ctid::TEXT FROM bets WHERE bet_id = 'b2600000-0000-4000-8000-0000000000b2'),
          (SELECT c FROM ctid_before WHERE id = 'b2600000-0000-4000-8000-0000000000b2'),
          'resultado corregido: la jugada que sigue perdiendo no se toca');

SELECT * FROM finish();
ROLLBACK;
