CREATE OR REPLACE FUNCTION generate_winners(
  target_id UUID,  -- schedule_id (turno)
  bet_date  DATE   -- fecha
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  WITH
  -- 1) Calcular payout/hits del turno y actualizar bets
  calculated_payouts AS (
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
    ) cp ON TRUE
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

  -- 2) Ganadores ahora en ESTE turno
  winners_now AS (
    SELECT DISTINCT ticket_id
    FROM up_bets
    WHERE payout > 0 OR hits > 0
  ),

  -- 3) candidates = ganadores ahora ∪ ex-ganadores que tenían fila para este turno/fecha
  candidates AS (
    SELECT ticket_id FROM winners_now
    UNION
    SELECT DISTINCT tpt.ticket_id
    FROM ticket_prizes_by_turn tpt
    WHERE tpt.schedule_id = target_id
      AND tpt.date        = bet_date
  ),

  -- 4) Recalcular aporte del turno para candidates (0 si ya no ganan)
  per_turn_recalc AS (
    SELECT
      c.ticket_id,
      COALESCE(SUM(b.prize), 0) AS prize_turn,
      COALESCE(SUM(b.hits),  0) AS hits_turn
    FROM candidates c
    LEFT JOIN bets b
      ON b.ticket_id   = c.ticket_id
     AND b.schedule_id = target_id
     AND b.date        = bet_date
     AND b.deleted_at IS NULL
    GROUP BY c.ticket_id
  ),

  -- 5A) Borrar filas que quedaron en 0 para este turno/fecha
  delete_zeros AS (
    DELETE FROM ticket_prizes_by_turn tpt
    USING per_turn_recalc ptr
    WHERE tpt.ticket_id   = ptr.ticket_id
      AND tpt.schedule_id = target_id
      AND tpt.date        = bet_date
      AND ptr.prize_turn = 0
      AND ptr.hits_turn  = 0
    RETURNING tpt.ticket_id
  ),

  -- 5B) UPSERT de filas > 0 (idempotente)
  upsert_rows AS (
    INSERT INTO ticket_prizes_by_turn (ticket_id, schedule_id, date, prize_turn, hits_turn, updated_at)
    SELECT
      ptr.ticket_id, target_id, bet_date,
      ptr.prize_turn, ptr.hits_turn, NOW()
    FROM per_turn_recalc ptr
    WHERE ptr.prize_turn > 0 OR ptr.hits_turn > 0
    ON CONFLICT (ticket_id, schedule_id, date) DO UPDATE
      SET prize_turn = EXCLUDED.prize_turn,
          hits_turn  = EXCLUDED.hits_turn,
          updated_at = NOW()
    RETURNING ticket_id
  ),

  -- 6) Totales del día SOLO para candidates
  totals_per_day AS (
    SELECT
      tpt.ticket_id,
      SUM(tpt.prize_turn) AS total_prize,
      SUM(tpt.hits_turn)  AS total_hits
    FROM ticket_prizes_by_turn tpt
    JOIN candidates c ON c.ticket_id = tpt.ticket_id
    WHERE tpt.date = bet_date
    GROUP BY tpt.ticket_id
  )

  -- 7) ÚNICA actualización del ticket (winner por total del día)
  UPDATE tickets t
     SET total_prize = COALESCE(tt.total_prize, 0),
         hits        = COALESCE(tt.total_hits,  0),
         winner      = (COALESCE(tt.total_prize, 0) > 0)
    FROM candidates c
    LEFT JOIN totals_per_day tt ON tt.ticket_id = c.ticket_id
   WHERE t.ticket_id = c.ticket_id
     AND t.date      = bet_date;

END;
$$;
