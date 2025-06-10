-- migrations/20250609_create_process_bets_function.sql

CREATE OR REPLACE FUNCTION public.process_bets()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  bet RECORD;
  calc_results TEXT[];
  result TEXT;
  match_count INT;
  payout NUMERIC := 0;
  number_count INT;
  with_count INT;
BEGIN
  CREATE TEMP TABLE temp_results AS
  SELECT
    lottery_id,
    schedule_id,
    date,
    results AS calc_results
  FROM results
  WHERE date >= current_date - interval '3 days';

  FOR bet IN
    SELECT * FROM bets
    WHERE date >= current_date - interval '3 days'
      AND deleted_at IS NULL
  LOOP
    SELECT tr.calc_results INTO calc_results
    FROM temp_results tr
    WHERE tr.lottery_id = bet.lottery_id
      AND tr.schedule_id = bet.schedule_id
      AND tr.date = bet.date;

    IF calc_results IS NULL THEN
      CONTINUE;
    END IF;

    payout := 0;

    IF bet.bet_type = 'ONE' AND bet.place = 'HEAD' THEN
      IF ends_with(calc_results[1], bet.number) THEN
        payout := 7 * bet.amount;
      END IF;

    ELSIF bet.bet_type = 'DOUBLE' THEN
      IF bet.place = 'HEAD' THEN
        IF ends_with(calc_results[1], bet.number) THEN
          payout := 70 * bet.amount;
        END IF;
      ELSIF bet.place = 'FIVE' THEN
        match_count := 0;
        FOR i IN 1..5 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            match_count := match_count + 1;
          END IF;
        END LOOP;
        payout := 14 * bet.amount * match_count;
      ELSIF bet.place = 'TEN' THEN
        match_count := 0;
        FOR i IN 1..10 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            match_count := match_count + 1;
          END IF;
        END LOOP;
        payout := 7 * bet.amount * match_count;
      ELSIF bet.place = 'TWENTY' THEN
        match_count := 0;
        FOR i IN 1..10 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            match_count := match_count + 1;
          END IF;
        END LOOP;
        payout := 3.5 * bet.amount * match_count;
      END IF;

    ELSIF bet.bet_type = 'TERN' THEN
      IF bet.place = 'HEAD' THEN
        IF ends_with(calc_results[1], bet.number) THEN
          payout := 600 * bet.amount;
        END IF;
      ELSIF bet.place = 'FIVE' THEN
        match_count := 0;
        FOR i IN 1..5 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            match_count := match_count + 1;
          END IF;
        END LOOP;
        payout := 120 * bet.amount * match_count;
      ELSIF bet.place = 'TEN' THEN
        match_count := 0;
        FOR i IN 1..10 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            match_count := match_count + 1;
          END IF;
        END LOOP;
        payout := 60 * bet.amount * match_count;
      ELSIF bet.place = 'TWENTY' THEN
        match_count := 0;
        FOR i IN 1..10 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            match_count := match_count + 1;
          END IF;
        END LOOP;
        payout := 30 * bet.amount * match_count;
      END IF;

    ELSIF bet.bet_type = 'QUATERN' THEN
      IF bet.place = 'HEAD' THEN
        IF calc_results[1] = bet.number THEN
          payout := 3500 * bet.amount;
        END IF;
      ELSIF bet.place = 'FIVE' THEN
        match_count := 0;
        FOR i IN 1..5 LOOP
          IF calc_results[i] = bet.number THEN
            match_count := match_count + 1;
          END IF;
        END LOOP;
        payout := 700 * bet.amount * match_count;
      ELSIF bet.place = 'TEN' THEN
        match_count := 0;
        FOR i IN 1..10 LOOP
          IF calc_results[i] = bet.number THEN
          match_count := match_count + 1;
          END IF;
        END LOOP;
        payout := 350 * bet.amount * match_count;
      ELSIF bet.place = 'TWENTY' THEN
        match_count := 0;
        FOR i IN 1..10 LOOP
          IF calc_results[i] = bet.number THEN
            match_count := match_count + 1;
          END IF;
        END LOOP;
        payout := 175 * bet.amount * match_count;
      END IF;

    ELSIF bet.bet_type = 'BORRATINA' THEN
      match_count := 0;
      FOR i IN 0..4 LOOP
        result := substring(bet.number FROM i*2+1 FOR 2);
        FOR j IN 1..18 LOOP
          IF position(result IN calc_results[j]) > 0 THEN
            match_count := match_count + 1;
          END IF;
        END LOOP;
      END LOOP;
      IF match_count >= 5 THEN
        payout := bet.amount * 1200;
      ELSIF match_count = 4 THEN
        payout := bet.amount * 80;
      ELSIF match_count = 3 THEN
        payout := bet.amount * 8;
      END IF;

    ELSIF bet.bet_type = 'REDOUBLE' THEN
      number_count := 0;
      with_count := 0;

      -- HEAD combos
      IF bet.place = 'HEAD' AND bet.position = 'FIVE' THEN
        IF ends_with(calc_results[1], bet.number) THEN
          FOR i IN 1..5 LOOP
            IF ends_with(calc_results[i], bet.with) THEN
              with_count := with_count + 1;
            END IF;
          END LOOP;
          IF with_count > 0 THEN
            payout := bet.amount * 1280 * with_count;
          END IF;
        END IF;

      ELSIF bet.place = 'HEAD' AND bet.position = 'TEN' THEN
        IF ends_with(calc_results[1], bet.number) THEN
          FOR i IN 1..10 LOOP
            IF ends_with(calc_results[i], bet.with) THEN
              with_count := with_count + 1;
            END IF;
          END LOOP;
          IF with_count > 0 THEN
            payout := bet.amount * 640 * with_count;
          END IF;
        END IF;

      ELSIF bet.place = 'HEAD' AND bet.position = 'TWENTY' THEN
        IF ends_with(calc_results[1], bet.number) THEN
          FOR i IN 1..20 LOOP
            IF ends_with(calc_results[i], bet.with) THEN
              with_count := with_count + 1;
            END IF;
          END LOOP;
          IF with_count > 0 THEN
            payout := bet.amount * 336 * with_count;
          END IF;
        END IF;

      -- Otras combinaciones
      ELSIF bet.place = 'FIVE' AND bet.position = 'FIVE' THEN
        FOR i IN 1..5 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            number_count := number_count + 1;
          END IF;
          IF ends_with(calc_results[i], bet.with) THEN
            with_count := with_count + 1;
          END IF;
        END LOOP;
        IF number_count > 0 AND with_count > 0 THEN
          payout := bet.amount * 256 * GREATEST(number_count, with_count);
        END IF;

      ELSIF bet.place = 'FIVE' AND bet.position = 'TEN' THEN
        FOR i IN 1..5 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            number_count := number_count + 1;
          END IF;
        END LOOP;
        FOR i IN 1..10 LOOP
          IF ends_with(calc_results[i], bet.with) THEN
            with_count := with_count + 1;
          END IF;
        END LOOP;
        IF number_count > 0 AND with_count > 0 THEN
          payout := bet.amount * 128 * GREATEST(number_count, with_count);
        END IF;

      ELSIF bet.place = 'FIVE' AND bet.position = 'TWENTY' THEN
        FOR i IN 1..5 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            number_count := number_count + 1;
          END IF;
        END LOOP;
        FOR i IN 1..20 LOOP
          IF ends_with(calc_results[i], bet.with) THEN
            with_count := with_count + 1;
          END IF;
        END LOOP;
        IF number_count > 0 AND with_count > 0 THEN
          payout := bet.amount * 128 * GREATEST(number_count, with_count);
        END IF;

      ELSIF bet.place = 'TEN' AND bet.position = 'TEN' THEN
        FOR i IN 1..10 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            number_count := number_count + 1;
          END IF;
          IF ends_with(calc_results[i], bet.with) THEN
            with_count := with_count + 1;
          END IF;
        END LOOP;
        IF number_count > 0 AND with_count > 0 THEN
          payout := bet.amount * 64 * GREATEST(number_count, with_count);
        END IF;

      ELSIF bet.place = 'TEN' AND bet.position = 'TWENTY' THEN
        FOR i IN 1..10 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            number_count := number_count + 1;
          END IF;
        END LOOP;
        FOR i IN 1..20 LOOP
          IF ends_with(calc_results[i], bet.with) THEN
            with_count := with_count + 1;
          END IF;
        END LOOP;
        IF number_count > 0 AND with_count > 0 THEN
          payout := bet.amount * 32 * GREATEST(number_count, with_count);
        END IF;

      ELSIF bet.place = 'TWENTY' AND bet.position = 'TWENTY' THEN
        FOR i IN 1..20 LOOP
          IF ends_with(calc_results[i], bet.number) THEN
            number_count := number_count + 1;
          END IF;
          IF ends_with(calc_results[i], bet.with) THEN
            with_count := with_count + 1;
          END IF;
        END LOOP;
        IF number_count > 0 AND with_count > 0 THEN
          payout := bet.amount * 16 * GREATEST(number_count, with_count);
        END IF;
      END IF;
    END IF;

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
    WHERE ticket_id = tickets.ticket_id
      AND deleted_at IS NULL
  )
  WHERE date >= current_date - interval '3 days'
    AND deleted_at IS NULL;
END;
$$;
