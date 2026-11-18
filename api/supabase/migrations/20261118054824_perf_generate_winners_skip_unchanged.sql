-- =============================================================================
-- Rendimiento SQL (docs/plan-rendimiento-sql.md): generate_winners solo escribe
-- las filas que cambian.
--
-- Medido en prod (delta de 24 h de pg_stat_statements): ~311 ms y ~50k buffers
-- por llamada a generate_winners_and_calculate_accounts. La versión anterior
-- hacía UPDATE de TODAS las jugadas del turno aunque el premio, los aciertos y
-- el ganador no cambiaran. Las jugadas se insertan con prize 0, hits 0 y
-- winner false, así que casi todas esas escrituras eran no-ops que igual
-- generaban una versión nueva de la fila y, como la mayoría no son HOT (HOT
-- ~25 % en prod), una entrada en cada uno de los índices de bets. Lo mismo con
-- tickets.
--
-- Cambios (mismo resultado, verificado con checksums y pgTAP 260):
--   * per_ticket_turn se calcula desde calculated_payouts (todas las jugadas
--     del turno) en vez del RETURNING del UPDATE.
--   * UPDATE de bets solo donde prize/hits/winner son distintos.
--   * UPDATE de tickets solo donde total_prize/hits/winner son distintos.
--   * El resultado (affected_tickets / winner_tickets) sigue contando todos los
--     tickets afectados del turno, como antes.
--
-- CREATE OR REPLACE sin DROP: misma firma, conserva los grants endurecidos
-- (solo service_role) y el search_path.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_winners(target_id uuid, bet_date date, p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_affected_tickets INT := 0;
  v_winner_tickets INT := 0;
BEGIN
  WITH
  calculated_payouts AS (
    SELECT
      b.bet_id,
      b.ticket_id,
      COALESCE(cp.payout, 0::NUMERIC) AS payout,
      COALESCE(cp.hits, 0::INT) AS hits
    FROM bets b
    JOIN results r
      ON b.lottery_id = r.lottery_id
     AND b.schedule_id = r.schedule_id
     AND b.date = r.date
     AND b.organization_id = r.organization_id
     AND r.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT payout, hits FROM calculate_one_payout(b, r.results) WHERE b.bet_type = 'ONE'
      UNION ALL
      SELECT payout, hits FROM calculate_double_payout(b, r.results) WHERE b.bet_type = 'DOUBLE'
      UNION ALL
      SELECT payout, hits FROM calculate_tern_payout(b, r.results) WHERE b.bet_type = 'TERN'
      UNION ALL
      SELECT payout, hits FROM calculate_quatern_payout(b, r.results) WHERE b.bet_type = 'QUATERN'
      UNION ALL
      SELECT payout, hits FROM calculate_borratina_payout(b, r.results) WHERE b.bet_type = 'BORRATINA'
      UNION ALL
      SELECT payout, hits FROM calculate_redouble_payout(b, r.results) WHERE b.bet_type = 'REDOUBLE'
    ) cp ON TRUE
    WHERE b.schedule_id = target_id
      AND b.date = bet_date
      AND b.organization_id = p_organization_id
      AND b.deleted_at IS NULL
  ),
  -- Solo las jugadas cuyo resultado cambia (los CTE con UPDATE se ejecutan
  -- aunque nadie lea su salida).
  up_bets AS (
    UPDATE bets b
    SET prize = cp.payout,
        hits = cp.hits,
        winner = (cp.payout > 0)
    FROM calculated_payouts cp
    WHERE b.bet_id = cp.bet_id
      AND b.organization_id = p_organization_id
      AND (b.prize IS DISTINCT FROM cp.payout
           OR b.hits IS DISTINCT FROM cp.hits
           OR b.winner IS DISTINCT FROM (cp.payout > 0))
    RETURNING b.bet_id
  ),
  per_ticket_turn AS (
    SELECT
      ticket_id,
      SUM(payout) AS prize_turn,
      SUM(hits) AS hits_turn
    FROM calculated_payouts
    GROUP BY ticket_id
  ),
  deleted_turn AS (
    DELETE FROM ticket_prizes_by_turn tpt
    WHERE tpt.schedule_id = target_id
      AND tpt.date = bet_date
      AND tpt.organization_id = p_organization_id
    RETURNING tpt.ticket_id
  ),
  affected_tickets AS (
    SELECT ticket_id FROM per_ticket_turn
    UNION
    SELECT ticket_id FROM deleted_turn
  ),
  inserted_turn AS (
    INSERT INTO ticket_prizes_by_turn
      (ticket_id, schedule_id, date, prize_turn, hits_turn, updated_at, organization_id)
    SELECT
      p.ticket_id,
      target_id,
      bet_date,
      p.prize_turn,
      p.hits_turn,
      NOW(),
      p_organization_id
    FROM per_ticket_turn p
  ),
  previous_turns AS (
    SELECT
      tpt.ticket_id,
      SUM(tpt.prize_turn) AS prize_prev,
      SUM(tpt.hits_turn) AS hits_prev
    FROM ticket_prizes_by_turn tpt
    JOIN affected_tickets at ON at.ticket_id = tpt.ticket_id
    WHERE tpt.date = bet_date
      AND tpt.schedule_id <> target_id
      AND tpt.organization_id = p_organization_id
    GROUP BY tpt.ticket_id
  ),
  totals_per_day AS (
    SELECT
      ticket_id,
      SUM(prize) AS total_prize,
      SUM(hits) AS total_hits
    FROM (
      SELECT
        p.ticket_id,
        p.prize_turn AS prize,
        p.hits_turn AS hits
      FROM per_ticket_turn p
      UNION ALL
      SELECT
        pt.ticket_id,
        pt.prize_prev AS prize,
        pt.hits_prev AS hits
      FROM previous_turns pt
    ) s
    GROUP BY ticket_id
  ),
  new_ticket_totals AS (
    SELECT
      at.ticket_id,
      COALESCE(tt.total_prize, 0) AS total_prize,
      COALESCE(tt.total_hits, 0) AS total_hits
    FROM affected_tickets at
    LEFT JOIN totals_per_day tt ON tt.ticket_id = at.ticket_id
  ),
  -- Solo los tickets cuyo total cambia.
  updated_tickets AS (
    UPDATE tickets t
    SET total_prize = nt.total_prize,
        hits = nt.total_hits,
        winner = (nt.total_prize > 0)
    FROM new_ticket_totals nt
    WHERE t.ticket_id = nt.ticket_id
      AND t.date = bet_date
      AND t.organization_id = p_organization_id
      AND (t.total_prize IS DISTINCT FROM nt.total_prize
           OR t.hits IS DISTINCT FROM nt.total_hits
           OR t.winner IS DISTINCT FROM (nt.total_prize > 0))
    RETURNING t.ticket_id
  )
  -- Mismo conteo que antes: todos los tickets afectados del turno que existen
  -- en tickets para ese día y organización, cambien o no.
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE nt.total_prize > 0)::INT
  INTO v_affected_tickets, v_winner_tickets
  FROM new_ticket_totals nt
  JOIN tickets t
    ON t.ticket_id = nt.ticket_id
   AND t.date = bet_date
   AND t.organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'schedule_id', target_id,
    'date', bet_date,
    'affected_tickets', COALESCE(v_affected_tickets, 0),
    'winner_tickets', COALESCE(v_winner_tickets, 0)
  );
END;
$function$;
