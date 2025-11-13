-- ============================================================================
-- Migración: Unificar generate_winners y calculate_current_account
-- ============================================================================
-- Parte 1: Modificar generate_winners para retornar JSONB en lugar de VOID
--          Esto fuerza a PostgreSQL a completar la transacción antes de retornar
-- Parte 2: Crear función unificada que ejecuta ambas en una sola transacción
-- ============================================================================

-- ============================================================================
-- PARTE 1: Modificar generate_winners para que retorne JSONB
-- ============================================================================

-- Borrar la función anterior para evitar conflictos
DROP FUNCTION IF EXISTS generate_winners(UUID, DATE);

CREATE OR REPLACE FUNCTION generate_winners(
  target_id UUID,  -- schedule_id (turno)
  bet_date  DATE   -- fecha
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_affected_tickets INT := 0;
  v_winner_tickets INT := 0;
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
    RETURNING tpt.ticket_id
  ),

  -- 4) Tickets afectados:
  affected_tickets AS (
    SELECT ticket_id FROM per_ticket_turn
    UNION
    SELECT ticket_id FROM deleted_turn
  ),

  -- 5) Re-llenado de la intermedia SOLO para el turno actual
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
  ),

  -- 6) Aportes de otros turnos del mismo día (distinto schedule)
  previous_turns AS (
    SELECT
      tpt.ticket_id,
      SUM(tpt.prize_turn) AS prize_prev,
      SUM(tpt.hits_turn)  AS hits_prev
    FROM ticket_prizes_by_turn tpt
    JOIN affected_tickets at ON at.ticket_id = tpt.ticket_id
    WHERE tpt.date = bet_date
      AND tpt.schedule_id <> target_id
    GROUP BY tpt.ticket_id
  ),

  -- 7) Totales del día = turno actual + otros turnos
  totals_per_day AS (
    SELECT
      ticket_id,
      SUM(prize) AS total_prize,
      SUM(hits)  AS total_hits
    FROM (
      -- Turno actual (desde el cálculo en memoria)
      SELECT
        p.ticket_id,
        p.prize_turn AS prize,
        p.hits_turn  AS hits
      FROM per_ticket_turn p

      UNION ALL

      -- Otros turnos ya existentes en la tabla
      SELECT
        pt.ticket_id,
        pt.prize_prev AS prize,
        pt.hits_prev  AS hits
      FROM previous_turns pt
    ) s
    GROUP BY ticket_id
  ),

  -- 8) ÚNICA actualización de tickets afectados (idempotente)
  updated_tickets AS (
    UPDATE tickets t
       SET total_prize = COALESCE(tt.total_prize, 0),
           hits        = COALESCE(tt.total_hits,  0),
           winner      = (COALESCE(tt.total_prize, 0) > 0)
     FROM affected_tickets at
     LEFT JOIN totals_per_day tt ON tt.ticket_id = at.ticket_id
    WHERE t.ticket_id = at.ticket_id
      AND t.date      = bet_date
    RETURNING t.ticket_id, (COALESCE(tt.total_prize, 0) > 0) as is_winner
  )


  -- 9) Capturar estadísticas para retornar
  SELECT
    COUNT(*)::INT as total,
    COUNT(*) FILTER (WHERE is_winner)::INT as winners
  INTO v_affected_tickets, v_winner_tickets
  FROM updated_tickets;

  -- 10) Retornar resultado JSON
  RETURN jsonb_build_object(
    'success', true,
    'schedule_id', target_id,
    'date', bet_date,
    'affected_tickets', COALESCE(v_affected_tickets, 0),
    'winner_tickets', COALESCE(v_winner_tickets, 0)
  );
END;
$$;
