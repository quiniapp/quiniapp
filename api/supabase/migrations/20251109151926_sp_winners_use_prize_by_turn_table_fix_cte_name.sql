CREATE OR REPLACE FUNCTION generate_winners(
  target_id UUID,  -- schedule_id (turno a cerrar/recalcular)
  bet_date  DATE   -- fecha del día
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1) Calcular payout/hits del turno y actualizar bets (idempotente)
  WITH calculated_payouts AS (
    SELECT
      b.bet_id,
      b.ticket_id,
      COALESCE(cp.payout, 0::NUMERIC) AS payout,
      COALESCE(cp.hits,   0::INT)     AS hits
    FROM bets b
    JOIN results r
      ON b.lottery_id  = r.lottery_id
     AND b.schedule_id = r.schedule_id
     AND b.date        = r.date
    LEFT JOIN LATERAL (
      SELECT payout, hits FROM calculate_one_payout(b, r.results)       WHERE b.bet_type = 'ONE'
      UNION ALL
      SELECT payout, hits FROM calculate_double_payout(b, r.results)    WHERE b.bet_type = 'DOUBLE'
      UNION ALL
      SELECT payout, hits FROM calculate_tern_payout(b, r.results)      WHERE b.bet_type = 'TERN'
      UNION ALL
      SELECT payout, hits FROM calculate_quatern_payout(b, r.results)   WHERE b.bet_type = 'QUATERN'
      UNION ALL
      SELECT payout, hits FROM calculate_borratina_payout(b, r.results) WHERE b.bet_type = 'BORRATINA'
      UNION ALL
      SELECT payout, hits FROM calculate_redouble_payout(b, r.results)  WHERE b.bet_type = 'REDOUBLE'
    ) AS cp ON TRUE
    WHERE b.schedule_id = target_id
      AND b.date        = bet_date
      AND b.deleted_at IS NULL
  ),
  up_bets AS (
    UPDATE bets b
       SET prize  = cp.payout,
           hits   = cp.hits,
           winner = (cp.payout > 0)
      FROM calculated_payouts cp
     WHERE b.bet_id = cp.bet_id
    RETURNING b.ticket_id, cp.payout, cp.hits
  ),
  -- sumas del turno por ticket (NO LLAMES ESTE CTE IGUAL QUE LA TABLA)
  per_turn_sum AS (
    SELECT
      ub.ticket_id,
      SUM(ub.payout) AS prize_turn,
      SUM(ub.hits)   AS hits_turn
    FROM up_bets ub
    GROUP BY ub.ticket_id
  ),

  -- 2) Borrar aporte previo de ESTE turno (todas las filas de ese turno/fecha)
  deleted_tpt_rows AS (
    DELETE FROM ticket_prizes_by_turn tpt
     WHERE tpt.schedule_id = target_id
       AND tpt.date        = bet_date
    RETURNING tpt.ticket_id
  ),

  -- 3) Insertar los nuevos aportes del turno
  inserted_tpt_rows AS (
    INSERT INTO ticket_prizes_by_turn (ticket_id, schedule_id, date, prize_turn, hits_turn, updated_at)
    SELECT
      pts.ticket_id,
      target_id,
      bet_date,
      pts.prize_turn,
      pts.hits_turn,
      NOW()
    FROM per_turn_sum pts
    RETURNING ticket_id
  ),

  -- 4) Tickets afectados (los que se insertaron ahora o los que tenían filas que se borraron)
  all_affected_tickets AS (
    SELECT ticket_id FROM inserted_tpt_rows
    UNION
    SELECT ticket_id FROM deleted_tpt_rows
  ),

  -- 5) Totales diarios (suma de todos los turnos del día) para esos tickets
  totals_per_day AS (
    SELECT
      tpt.ticket_id,
      SUM(tpt.prize_turn) AS total_prize,
      SUM(tpt.hits_turn)  AS total_hits
    FROM ticket_prizes_by_turn tpt
    JOIN all_affected_tickets aat ON aat.ticket_id = tpt.ticket_id
    WHERE tpt.date = bet_date
    GROUP BY tpt.ticket_id
  )

  -- 6) Actualizar tickets (LEFT JOIN para setear 0 si ya no tienen premios)
  UPDATE tickets t
     SET total_prize = COALESCE(tt.total_prize, 0),
         hits        = COALESCE(tt.total_hits,  0),
         winner      = (COALESCE(tt.total_prize, 0) > 0)
    FROM all_affected_tickets aat
    LEFT JOIN totals_per_day tt ON tt.ticket_id = aat.ticket_id
   WHERE t.ticket_id = aat.ticket_id
     AND t.date      = bet_date;

END;
$$;
