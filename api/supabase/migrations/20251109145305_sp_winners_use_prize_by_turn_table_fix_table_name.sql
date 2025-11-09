CREATE OR REPLACE FUNCTION generate_winners(
  target_id UUID,   -- schedule_id (turno a cerrar/recalcular)
  bet_date  DATE    -- fecha del día
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1) Calcular payout/hits por apuesta del turno (idempotente)
  WITH calculated_payouts AS (
    SELECT
      b.bet_id,
      b.ticket_id,
      cp.payout,
      cp.hits
    FROM bets b
    JOIN results r
      ON b.lottery_id  = r.lottery_id
     AND b.schedule_id = r.schedule_id
     AND b.date        = r.date
    CROSS JOIN LATERAL (
      -- Cada rama produce payout,hits; el fallback final garantiza fila para no ganadores
      SELECT payout, hits
        FROM calculate_one_payout(b, r.results)       WHERE b.bet_type = 'ONE'
      UNION ALL
      SELECT payout, hits
        FROM calculate_double_payout(b, r.results)    WHERE b.bet_type = 'DOUBLE'
      UNION ALL
      SELECT payout, hits
        FROM calculate_tern_payout(b, r.results)      WHERE b.bet_type = 'TERN'
      UNION ALL
      SELECT payout, hits
        FROM calculate_quatern_payout(b, r.results)   WHERE b.bet_type = 'QUATERN'
      UNION ALL
      SELECT payout, hits
        FROM calculate_borratina_payout(b, r.results) WHERE b.bet_type = 'BORRATINA'
      UNION ALL
      SELECT payout, hits
        FROM calculate_redouble_payout(b, r.results)  WHERE b.bet_type = 'REDOUBLE'
      UNION ALL
      -- Fallback para no ganadores (asegura idempotencia al recalcular)
      SELECT 0::NUMERIC AS payout, 0::INT AS hits
    ) AS cp
    WHERE b.schedule_id = target_id
      AND b.date        = bet_date
      AND b.deleted_at IS NULL
  ),

  -- 2) Actualizar TODAS las apuestas del turno (ganadoras y no)
  up_bets AS (
    UPDATE bets b
       SET prize  = cp.payout,
           hits   = cp.hits,
           winner = (cp.payout > 0)
      FROM calculated_payouts cp
     WHERE b.bet_id = cp.bet_id
    RETURNING b.ticket_id
  ),

  -- 3) Tickets afectados en este turno
  affected_tickets AS (
    SELECT DISTINCT ticket_id FROM up_bets
  ),

  -- 4) Aporte del turno por ticket (puede ser 0)
  ticket_prizes_by_turn AS (
    SELECT
      cp.ticket_id,
      SUM(cp.payout) AS prize_turn,
      SUM(cp.hits)   AS hits_turn
    FROM calculated_payouts cp
    GROUP BY cp.ticket_id
  )

  -- 5) Reemplazar filas del turno en la tabla intermedia (idempotente)
  DELETE FROM ticket_prizes_by_turn tpt
   USING affected_tickets at
   WHERE tpt.ticket_id  = at.ticket_id
     AND tpt.schedule_id = target_id
     AND tpt.date        = bet_date;

  INSERT INTO ticket_prizes_by_turn (ticket_id, schedule_id, date, prize_turn, hits_turn, updated_at)
  SELECT
    p.ticket_id, target_id, bet_date,
    COALESCE(p.prize_turn, 0), COALESCE(p.hits_turn, 0), NOW()
  FROM ticket_prizes_by_turn p
  ON CONFLICT (ticket_id, schedule_id, date) DO UPDATE
    SET prize_turn = EXCLUDED.prize_turn,
        hits_turn  = EXCLUDED.hits_turn,
        updated_at = NOW();

  -- 6) Recomponer totales del ticket para ese día (suma de todos los turnos del día)
  WITH totals AS (
    SELECT
      tpt.ticket_id,
      SUM(tpt.prize_turn) AS total_prize,
      SUM(tpt.hits_turn)  AS total_hits
    FROM ticket_prizes_by_turn tpt
    WHERE tpt.date = bet_date
    GROUP BY tpt.ticket_id
  )
  UPDATE tickets t
     SET total_prize = COALESCE(tt.total_prize, 0),
         hits        = COALESCE(tt.total_hits, 0),
         winner      = (COALESCE(tt.total_prize, 0) > 0)
    FROM totals tt
   WHERE t.ticket_id = tt.ticket_id
     AND t.date      = bet_date;

END;
$$;
