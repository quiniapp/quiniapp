CREATE OR REPLACE FUNCTION calculate_one_payout(bet RECORD, results TEXT[])
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
BEGIN
  IF bet.place = 'HEAD' AND ends_with(results[1], bet.number) THEN
    RETURN 7 * bet.amount;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_double_payout(bet RECORD, results TEXT[])
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  match_count INT := 0;
BEGIN
  IF bet.place = 'HEAD' AND ends_with(results[1], bet.number) THEN
    RETURN 70 * bet.amount;
  ELSIF bet.place = 'FIVE' THEN
    FOR i IN 1..5 LOOP
      IF ends_with(results[i], bet.number) THEN match_count := match_count + 1; END IF;
    END LOOP;
    RETURN 14 * bet.amount * match_count;
  ELSIF bet.place = 'TEN' THEN
    FOR i IN 1..10 LOOP
      IF ends_with(results[i], bet.number) THEN match_count := match_count + 1; END IF;
    END LOOP;
    RETURN 7 * bet.amount * match_count;
  ELSIF bet.place = 'TWENTY' THEN
    FOR i IN 1..10 LOOP
      IF ends_with(results[i], bet.number) THEN match_count := match_count + 1; END IF;
    END LOOP;
    RETURN 3.5 * bet.amount * match_count;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_tern_payout(bet RECORD, results TEXT[])
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  match_count INT := 0;
BEGIN
  IF bet.place = 'HEAD' AND ends_with(results[1], bet.number) THEN
    RETURN 600 * bet.amount;
  ELSIF bet.place = 'FIVE' THEN
    FOR i IN 1..5 LOOP
      IF ends_with(results[i], bet.number) THEN match_count := match_count + 1; END IF;
    END LOOP;
    RETURN 120 * bet.amount * match_count;
  ELSIF bet.place = 'TEN' THEN
    FOR i IN 1..10 LOOP
      IF ends_with(results[i], bet.number) THEN match_count := match_count + 1; END IF;
    END LOOP;
    RETURN 60 * bet.amount * match_count;
  ELSIF bet.place = 'TWENTY' THEN
    FOR i IN 1..10 LOOP
      IF ends_with(results[i], bet.number) THEN match_count := match_count + 1; END IF;
    END LOOP;
    RETURN 30 * bet.amount * match_count;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_quatern_payout(bet RECORD, results TEXT[])
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  match_count INT := 0;
BEGIN
  IF bet.place = 'HEAD' AND results[1] = bet.number THEN
    RETURN 3500 * bet.amount;
  ELSIF bet.place = 'FIVE' THEN
    FOR i IN 1..5 LOOP
      IF results[i] = bet.number THEN match_count := match_count + 1; END IF;
    END LOOP;
    RETURN 700 * bet.amount * match_count;
  ELSIF bet.place = 'TEN' THEN
    FOR i IN 1..10 LOOP
      IF results[i] = bet.number THEN match_count := match_count + 1; END IF;
    END LOOP;
    RETURN 350 * bet.amount * match_count;
  ELSIF bet.place = 'TWENTY' THEN
    FOR i IN 1..10 LOOP
      IF results[i] = bet.number THEN match_count := match_count + 1; END IF;
    END LOOP;
    RETURN 175 * bet.amount * match_count;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_borratina_payout(bet RECORD, results TEXT[])
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  match_count INT := 0;
  result TEXT;
BEGIN
  FOR i IN 0..4 LOOP
    result := substring(bet.number FROM i*2+1 FOR 2);
    FOR j IN 1..18 LOOP
      IF position(result IN results[j]) > 0 THEN
        match_count := match_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  IF match_count >= 5 THEN
    RETURN bet.amount * 1200;
  ELSIF match_count = 4 THEN
    RETURN bet.amount * 80;
  ELSIF match_count = 3 THEN
    RETURN bet.amount * 8;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_redouble_payout(bet RECORD, results TEXT[])
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  number_count INT := 0;
  with_count INT := 0;
BEGIN
  -- HEAD combos
  IF bet.place = 'HEAD' AND bet.position = 'FIVE' THEN
    IF ends_with(results[1], bet.number) THEN
      FOR i IN 1..5 LOOP
        IF ends_with(results[i], bet.with) THEN with_count := with_count + 1; END IF;
      END LOOP;
      IF with_count > 0 THEN RETURN bet.amount * 1280 * with_count; END IF;
    END IF;
  ELSIF bet.place = 'HEAD' AND bet.position = 'TEN' THEN
    IF ends_with(results[1], bet.number) THEN
      FOR i IN 1..10 LOOP
        IF ends_with(results[i], bet.with) THEN with_count := with_count + 1; END IF;
      END LOOP;
      IF with_count > 0 THEN RETURN bet.amount * 640 * with_count; END IF;
    END IF;
  ELSIF bet.place = 'HEAD' AND bet.position = 'TWENTY' THEN
    IF ends_with(results[1], bet.number) THEN
      FOR i IN 1..20 LOOP
        IF ends_with(results[i], bet.with) THEN with_count := with_count + 1; END IF;
      END LOOP;
      IF with_count > 0 THEN RETURN bet.amount * 336 * with_count; END IF;
    END IF;
  -- Other combinations
  ELSIF bet.place = 'FIVE' AND bet.position = 'FIVE' THEN
    FOR i IN 1..5 LOOP
      IF ends_with(results[i], bet.number) THEN number_count := number_count + 1; END IF;
      IF ends_with(results[i], bet.with) THEN with_count := with_count + 1; END IF;
    END LOOP;
    IF number_count > 0 AND with_count > 0 THEN
      RETURN bet.amount * 256 * GREATEST(number_count, with_count);
    END IF;
  ELSIF bet.place = 'FIVE' AND bet.position = 'TEN' THEN
    FOR i IN 1..5 LOOP
      IF ends_with(results[i], bet.number) THEN number_count := number_count + 1; END IF;
    END LOOP;
    FOR i IN 1..10 LOOP
      IF ends_with(results[i], bet.with) THEN with_count := with_count + 1; END IF;
    END LOOP;
    IF number_count > 0 AND with_count > 0 THEN
      RETURN bet.amount * 128 * GREATEST(number_count, with_count);
    END IF;
  ELSIF bet.place = 'FIVE' AND bet.position = 'TWENTY' THEN
    FOR i IN 1..5 LOOP
      IF ends_with(results[i], bet.number) THEN number_count := number_count + 1; END IF;
    END LOOP;
    FOR i IN 1..20 LOOP
      IF ends_with(results[i], bet.with) THEN with_count := with_count + 1; END IF;
    END LOOP;
    IF number_count > 0 AND with_count > 0 THEN
      RETURN bet.amount * 128 * GREATEST(number_count, with_count);
    END IF;
  ELSIF bet.place = 'TEN' AND bet.position = 'TEN' THEN
    FOR i IN 1..10 LOOP
      IF ends_with(results[i], bet.number) THEN number_count := number_count + 1; END IF;
      IF ends_with(results[i], bet.with) THEN with_count := with_count + 1; END IF;
    END LOOP;
    IF number_count > 0 AND with_count > 0 THEN
      RETURN bet.amount * 64 * GREATEST(number_count, with_count);
    END IF;
  ELSIF bet.place = 'TEN' AND bet.position = 'TWENTY' THEN
    FOR i IN 1..10 LOOP
      IF ends_with(results[i], bet.number) THEN number_count := number_count + 1; END IF;
    END LOOP;
    FOR i IN 1..20 LOOP
      IF ends_with(results[i], bet.with) THEN with_count := with_count + 1; END IF;
    END LOOP;
    IF number_count > 0 AND with_count > 0 THEN
      RETURN bet.amount * 32 * GREATEST(number_count, with_count);
    END IF;
  ELSIF bet.place = 'TWENTY' AND bet.position = 'TWENTY' THEN
    FOR i IN 1..20 LOOP
      IF ends_with(results[i], bet.number) THEN number_count := number_count + 1; END IF;
      IF ends_with(results[i], bet.with) THEN with_count := with_count + 1; END IF;
    END LOOP;
    IF number_count > 0 AND with_count > 0 THEN
      RETURN bet.amount * 16 * GREATEST(number_count, with_count);
    END IF;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION generate_winners(schedule_id UUID, bet_date DATE)
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
  WHERE schedule_id = generate_winners.schedule_id
    AND date = generate_winners.bet_date;

  FOR bet IN
    SELECT * FROM bets
    WHERE schedule_id = generate_winners.schedule_id
      AND date = generate_winners.bet_date
      AND deleted_at IS NULL
  LOOP
    SELECT tr.calc_results INTO calc_results
    FROM temp_results tr
    WHERE tr.lottery_id = bet.lottery_id;

    IF calc_results IS NULL THEN CONTINUE; END IF;

    -- Delegar cálculo del payout según tipo
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

  -- Actualizar premios totales del ticket
  UPDATE tickets
  SET total_prize = (
    SELECT COALESCE(SUM(prize), 0)
    FROM bets
    WHERE ticket_id = tickets.ticket_id AND deleted_at IS NULL
  )
  WHERE schedule_id = generate_winners.schedule_id
    AND date = generate_winners.bet_date
    AND deleted_at IS NULL;
END;
$$;
