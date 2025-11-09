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
    -- OPTIMIZACIÓN: Devolvemos los datos calculados para reutilizarlos
    RETURNING b.ticket_id, cp.payout, cp.hits
  ),

  -- 2) Agregado por ticket PARA ESTE TURNO (basado en el cálculo anterior)
  per_ticket_turn AS (
    SELECT
      ticket_id,
      SUM(payout) AS prize_turn,
      SUM(hits)   AS hits_turn
    FROM up_bets
    GROUP BY ticket_id
  ),

  -- 3) Borrado total de la intermedia Y OBTENER tickets antiguos (MÁS EFICIENTE)
  deleted_turn AS (
    DELETE FROM ticket_prizes_by_turn tpt
     WHERE tpt.schedule_id = target_id
       AND tpt.date        = bet_date
    -- Borra Y retorna los IDs afectados en un solo paso
    RETURNING tpt.ticket_id
  ),

  -- 4) Tickets afectados:
  --    (los que tienen datos NUEVOS) ∪ (los que tenían datos ANTIGUOS)
  affected_tickets AS (
    SELECT ticket_id FROM per_ticket_turn
    UNION
    -- Leemos los IDs del borrado, no volvemos a consultar la tabla
    SELECT ticket_id FROM deleted_turn
  ),

  -- 5) Re-llenado de la intermedia (OPTIMIZADO: lee de 'per_ticket_turn')
  --    (Se quita el filtro para insertar TODOS los resultados, incluso $0)
  inserted_turn AS (
    INSERT INTO ticket_prizes_by_turn
      (ticket_id, schedule_id, date, prize_turn, hits_turn, updated_at)
    SELECT
      p.ticket_id,
      target_id,
      bet_date,
      p.prize_turn,
      p.hits_turn,
      NOW()
    FROM per_ticket_turn p
    -- FILTRO ELIMINADO: (WHERE p.prize_turn > 0 OR p.hits_turn > 0)
  ),

  -- 6) Totales del día (suma de todos los turnos) SOLO para los tickets afectados
  totals_per_day AS (
    SELECT
      tpt.ticket_id,
      SUM(tpt.prize_turn) AS total_prize,
      SUM(tpt.hits_turn)  AS total_hits
    FROM ticket_prizes_by_turn tpt
    -- Unimos a 'affected_tickets' para recalcular solo lo necesario
    JOIN affected_tickets at ON at.ticket_id = tpt.ticket_id
    WHERE tpt.date = bet_date
    GROUP BY tpt.ticket_id
  )

  -- 7) ÚNICA actualización de tickets afectados (idempotente)
  UPDATE tickets t
     SET total_prize = COALESCE(tt.total_prize, 0),
         hits        = COALESCE(tt.total_hits,  0),
         winner      = (COALESCE(tt.total_prize, 0) > 0)
   FROM affected_tickets at
   -- LEFT JOIN es la clave: si un ticket ya no tiene premios,
   -- 'tt' será NULL y COALESCE lo pondrá en 0.
   LEFT JOIN totals_per_day tt ON tt.ticket_id = at.ticket_id
  WHERE t.ticket_id = at.ticket_id
    AND t.date      = bet_date;

END;
$$;