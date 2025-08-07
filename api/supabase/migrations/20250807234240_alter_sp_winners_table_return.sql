CREATE OR REPLACE FUNCTION generate_winners(
  target_id UUID,
  bet_date  DATE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
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
      -- Cada rama produce exactamente las mismas columnas payout,hits
      SELECT payout, hits
        FROM calculate_one_payout(b, r.results)
       WHERE b.bet_type = 'ONE'
      UNION ALL
      SELECT payout, hits
        FROM calculate_double_payout(b, r.results)
       WHERE b.bet_type = 'DOUBLE'
      UNION ALL
      SELECT payout, hits
        FROM calculate_tern_payout(b, r.results)
       WHERE b.bet_type = 'TERN'
      UNION ALL
      SELECT payout, hits
        FROM calculate_quatern_payout(b, r.results)
       WHERE b.bet_type = 'QUATERN'
      UNION ALL
      SELECT payout, hits
        FROM calculate_borratina_payout(b, r.results)
       WHERE b.bet_type = 'BORRATINA'
      UNION ALL
      SELECT payout, hits
        FROM calculate_redouble_payout(b, r.results)
       WHERE b.bet_type = 'REDOUBLE'
      UNION ALL
      -- último fallback para no ganadores
      SELECT 0::NUMERIC AS payout, 0::INT AS hits
    ) AS cp
    WHERE
      b.schedule_id = target_id
      AND b.date        = bet_date
      AND b.deleted_at IS NULL
  ),
  updated_bets AS (
    UPDATE bets b
       SET winner = true,
           prize  = cp.payout,
           hits   = cp.hits
      FROM calculated_payouts cp
     WHERE b.bet_id = cp.bet_id
       AND cp.payout > 0
  ),
  ticket_summary AS (
    SELECT
      ticket_id,
      SUM(payout) AS total_prize,
      SUM(hits)   AS total_hits
    FROM calculated_payouts
    WHERE payout > 0
    GROUP BY ticket_id
  )
  UPDATE tickets t
     SET winner      = true,
         total_prize = ts.total_prize,
         hits        = ts.total_hits
    FROM ticket_summary ts
   WHERE t.ticket_id = ts.ticket_id;
END;
$$;
