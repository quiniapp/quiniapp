CREATE OR REPLACE FUNCTION generate_winners(
  target_id UUID,  -- schedule_id (turno a cerrar/recalcular)
  bet_date  DATE    -- fecha del día
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1) Calcular payout/hits (OPTIMIZADO: con LEFT JOIN LATERAL)
  WITH calculated_payouts AS (
    SELECT
      b.bet_id,
      b.ticket_id,
      -- Usar COALESCE para manejar no-ganadores (NULLs del LEFT JOIN)
      COALESCE(cp.payout, 0::NUMERIC) AS payout,
      COALESCE(cp.hits, 0::INT) AS hits
    FROM bets b
    JOIN results r
      ON b.lottery_id  = r.lottery_id
     AND b.schedule_id = r.schedule_id
     AND b.date        = r.date
    -- LEFT JOIN LATERAL es más limpio que el CROSS JOIN + UNION con fallback
    LEFT JOIN LATERAL (
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
    ) AS cp ON true -- 'ON true' es estándar para este patrón
    WHERE b.schedule_id = target_id
      AND b.date        = bet_date
      AND b.deleted_at IS NULL
  ),

  -- 2) Actualizar TODAS las apuestas del turno (OPTIMIZADO: RETURNING más datos)
  up_bets AS (
    UPDATE bets b
       SET prize  = cp.payout,
           hits   = cp.hits,
           winner = (cp.payout > 0)
     FROM calculated_payouts cp
    WHERE b.bet_id = cp.bet_id
    -- Devolver todo lo necesario para el siguiente paso
    RETURNING b.ticket_id, cp.payout, cp.hits
  ),

  -- 3) Aporte del turno por ticket (OPTIMIZADO: lee de up_bets)
  per_ticket_turn AS (
    SELECT
      ticket_id,
      SUM(payout) AS prize_turn,
      SUM(hits)   AS hits_turn
    FROM up_bets
    GROUP BY ticket_id
  ),

  -- 4) BUGFIX: Limpiar *todos* los datos viejos de este turno
  -- Esto es crucial para la idempotencia y para limpiar tickets
  -- cuyas apuestas fueron borradas.
  deleted_tpt_rows AS (
      DELETE FROM ticket_prizes_by_turn tpt
      WHERE tpt.schedule_id = target_id
        AND tpt.date        = bet_date
      RETURNING tpt.ticket_id -- Para saber qué tickets recalcular
  ),

  -- 5) Insertar los nuevos cálculos (ya no se necesita ON CONFLICT)
  inserted_tpt_rows AS (
      INSERT INTO ticket_prizes_by_turn (ticket_id, schedule_id, date, prize_turn, hits_turn, updated_at)
      SELECT
        p.ticket_id, target_id, bet_date,
        p.prize_turn, p.hits_turn, NOW()
      FROM per_ticket_turn p
      RETURNING ticket_id -- Para saber qué tickets recalcular
  ),

  -- 6) BUGFIX: Lista completa de tickets cuyos totales diarios deben
  -- recalcularse (tanto los que se insertaron como los que se borraron)
  all_affected_tickets AS (
      SELECT ticket_id FROM inserted_tpt_rows
      UNION
      SELECT ticket_id FROM deleted_tpt_rows
  ),

  -- 7) Recomponer totales del día
  totals_per_day AS (
    SELECT
      tpt.ticket_id,
      SUM(tpt.prize_turn) AS total_prize,
      SUM(tpt.hits_turn)  AS total_hits
    FROM ticket_prizes_by_turn tpt
    -- Optimización: Unirse solo a los tickets que sabemos que cambiaron
    JOIN all_affected_tickets aat ON tpt.ticket_id = aat.ticket_id
    WHERE tpt.date = bet_date
    GROUP BY tpt.ticket_id
  )

  -- 8) BUGFIX: Actualizar totales de 'tickets' usando LEFT JOIN
  -- para poner en cero los tickets que ya no tienen premios.
  UPDATE tickets t
     SET total_prize = COALESCE(tt.total_prize, 0),
         hits        = COALESCE(tt.total_hits, 0),
         winner      = (COALESCE(tt.total_prize, 0) > 0)
  -- El FROM es la lista de *todos* los tickets que tocamos
  FROM all_affected_tickets aat
  -- El LEFT JOIN busca sus totales; si no hay (NULL), COALESCE lo vuelve 0
  LEFT JOIN totals_per_day tt ON aat.ticket_id = tt.ticket_id
  WHERE t.ticket_id = aat.ticket_id
    AND t.date      = bet_date;

END;
$$;