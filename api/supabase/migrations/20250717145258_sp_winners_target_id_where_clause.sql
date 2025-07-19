DROP FUNCTION IF EXISTS generate_winners(UUID, DATE);


CREATE OR REPLACE FUNCTION generate_winners(target_id UUID, bet_date DATE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  bet RECORD;
  calc_results TEXT[];
  payout NUMERIC := 0;
BEGIN
  CREATE TEMP TABLE temp_results AS
  SELECT
    lottery_id,
    schedule_id,
    date,
    results AS calc_results
  FROM results
  WHERE schedule_id = generate_winners.target_id
    AND date = generate_winners.bet_date;

  FOR bet IN
    SELECT * FROM bets
    WHERE schedule_id = generate_winners.target_id
      AND date = generate_winners.bet_date
      AND deleted_at IS NULL
  LOOP
    SELECT tr.calc_results INTO calc_results
    FROM temp_results tr
    WHERE tr.lottery_id = bet.lottery_id;

    IF calc_results IS NULL THEN CONTINUE; END IF;

    CASE bet.bet_type
      WHEN 'ONE' THEN
        payout := calculate_one_payout(bet, calc_results);
      WHEN 'DOUBLE' THEN
        payout := calculate_double_payout(bet, calc_results);
      WHEN 'TERN' THEN
        payout := calculate_tern_payout(bet, calc_results);
      WHEN 'QUATERN' THEN
        payout := calculate_quatern_payout(bet, calc_results);
      WHEN 'BORRATINA' THEN
        payout := calculate_borratina_payout(bet, calc_results);
      WHEN 'REDOUBLE' THEN
        payout := calculate_redouble_payout(bet, calc_results);
      ELSE
        payout := 0;
    END CASE;

    IF payout > 0 THEN
      UPDATE bets
      SET winner = true, prize = payout
      WHERE bet_id = bet.bet_id;

      UPDATE tickets
      SET winner = true
      WHERE ticket_id = bet.ticket_id;
    END IF;
  END LOOP;

  UPDATE tickets
  SET total_prize = (
    SELECT COALESCE(SUM(prize), 0)
    FROM bets
    WHERE ticket_id = tickets.ticket_id AND deleted_at IS NULL
  )
  WHERE date = generate_winners.bet_date
    AND deleted_at IS NULL;
END;
$$;
