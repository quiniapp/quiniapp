-- Para la cláusula WHERE y el JOIN principal
CREATE INDEX IF NOT EXISTS idx_bets_schedule_date ON bets (schedule_id, date);
CREATE INDEX IF NOT EXISTS idx_results_schedule_date ON results (schedule_id, date);

-- Para los JOINs y las actualizaciones
CREATE INDEX IF NOT EXISTS idx_bets_ticket_id ON bets (ticket_id);
CREATE INDEX IF NOT EXISTS idx_bets_lottery_id ON bets (lottery_id);
CREATE INDEX IF NOT EXISTS idx_results_lottery_id ON results (lottery_id);

CREATE OR REPLACE FUNCTION calculate_one_payout(bet RECORD, results TEXT[])
RETURNS RECORD
LANGUAGE plpgsql
AS $$
DECLARE
  result RECORD;
BEGIN
  SELECT
    CASE WHEN bet.place = 'HEAD' AND ends_with(results[1], bet.number)
         THEN 7 * bet.amount
         ELSE 0
    END AS payout,
    CASE WHEN bet.place = 'HEAD' AND ends_with(results[1], bet.number)
         THEN 1
         ELSE 0
    END AS hits
  INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_double_payout(bet RECORD, results TEXT[])
RETURNS RECORD
LANGUAGE plpgsql
AS $$
DECLARE
  match_count INT;
  result RECORD;
BEGIN
  IF bet.place = 'HEAD' THEN
    match_count := CASE WHEN ends_with(results[1], bet.number) THEN 1 ELSE 0 END;
    SELECT
      match_count * 70 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSIF bet.place = 'FIVE' THEN
    SELECT
      COUNT(*)::INT AS cnt
    INTO match_count
    FROM unnest(results[1:5]) AS r
    WHERE ends_with(r, bet.number);
    SELECT
      match_count * 14 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSIF bet.place = 'TEN' THEN
    SELECT
      COUNT(*)::INT AS cnt
    INTO match_count
    FROM unnest(results[1:10]) AS r
    WHERE ends_with(r, bet.number);
    SELECT
      match_count * 7 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSIF bet.place = 'TWENTY' THEN
    SELECT
      COUNT(*)::INT AS cnt
    INTO match_count
    FROM unnest(results[1:10]) AS r
    WHERE ends_with(r, bet.number);
    SELECT
      match_count * 3.5 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSE
    SELECT 0 AS payout, 0 AS hits INTO result;
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_tern_payout(bet RECORD, results TEXT[])
RETURNS RECORD
LANGUAGE plpgsql
AS $$
DECLARE
  match_count INT;
  result RECORD;
BEGIN
  IF bet.place = 'HEAD' THEN
    match_count := CASE WHEN ends_with(results[1], bet.number) THEN 1 ELSE 0 END;
    SELECT
      match_count * 600 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSIF bet.place = 'FIVE' THEN
    SELECT
      COUNT(*)::INT AS cnt
    INTO match_count
    FROM unnest(results[1:5]) AS r
    WHERE ends_with(r, bet.number);
    SELECT
      match_count * 120 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSIF bet.place = 'TEN' THEN
    SELECT
      COUNT(*)::INT AS cnt
    INTO match_count
    FROM unnest(results[1:10]) AS r
    WHERE ends_with(r, bet.number);
    SELECT
      match_count * 60 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSIF bet.place = 'TWENTY' THEN
    SELECT
      COUNT(*)::INT AS cnt
    INTO match_count
    FROM unnest(results[1:10]) AS r
    WHERE ends_with(r, bet.number);
    SELECT
      match_count * 30 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSE
    SELECT 0 AS payout, 0 AS hits INTO result;
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_quatern_payout(bet RECORD, results TEXT[])
RETURNS RECORD
LANGUAGE plpgsql
AS $$
DECLARE
  match_count INT;
  result RECORD;
BEGIN
  IF bet.place = 'HEAD' THEN
    match_count := CASE WHEN results[1] = bet.number THEN 1 ELSE 0 END;
    SELECT
      match_count * 3500 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSIF bet.place = 'FIVE' THEN
    SELECT
      COUNT(*)::INT AS cnt
    INTO match_count
    FROM unnest(results[1:5]) AS r
    WHERE r = bet.number;
    SELECT
      match_count * 700 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSIF bet.place = 'TEN' THEN
    SELECT
      COUNT(*)::INT AS cnt
    INTO match_count
    FROM unnest(results[1:10]) AS r
    WHERE r = bet.number;
    SELECT
      match_count * 350 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSIF bet.place = 'TWENTY' THEN
    SELECT
      COUNT(*)::INT AS cnt
    INTO match_count
    FROM unnest(results[1:10]) AS r
    WHERE r = bet.number;
    SELECT
      match_count * 175 * bet.amount AS payout,
      match_count AS hits
    INTO result;
  ELSE
    SELECT 0 AS payout, 0 AS hits INTO result;
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_borratina_payout(bet RECORD, results TEXT[])
RETURNS RECORD
LANGUAGE plpgsql
AS $$
DECLARE
  match_count INT;
  result RECORD;
BEGIN
  SELECT
    COUNT(*)::INT AS cnt
  INTO match_count
  FROM generate_series(0, 4) AS i
  CROSS JOIN unnest(results[1:18]) AS r
  WHERE position(substring(bet.number FROM i*2+1 FOR 2) IN r) > 0;

  SELECT
    CASE
      WHEN match_count >= 5 THEN bet.amount * 1200
      WHEN match_count = 4 THEN bet.amount * 80
      WHEN match_count = 3 THEN bet.amount * 8
      ELSE 0
    END AS payout,
    match_count AS hits
  INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_redouble_payout(bet RECORD, results TEXT[])
RETURNS RECORD
LANGUAGE plpgsql
AS $$
DECLARE
  number_count INT;
  with_count INT;
  result RECORD;
BEGIN
  IF bet.place = 'HEAD' THEN
    number_count := CASE WHEN ends_with(results[1], bet.number) THEN 1 ELSE 0 END;
    IF bet.position = 'FIVE' THEN
      SELECT COUNT(*)::INT INTO with_count
      FROM unnest(results[1:5]) AS r WHERE ends_with(r, bet.with);
      SELECT
        CASE WHEN number_count > 0 AND with_count > 0 THEN bet.amount * 1280 * with_count ELSE 0 END AS payout,
        with_count AS hits
      INTO result;
    ELSIF bet.position = 'TEN' THEN
      SELECT COUNT(*)::INT INTO with_count
      FROM unnest(results[1:10]) AS r WHERE ends_with(r, bet.with);
      SELECT
        CASE WHEN number_count > 0 AND with_count > 0 THEN bet.amount * 640 * with_count ELSE 0 END AS payout,
        with_count AS hits
      INTO result;
    ELSIF bet.position = 'TWENTY' THEN
      SELECT COUNT(*)::INT INTO with_count
      FROM unnest(results[1:20]) AS r WHERE ends_with(r, bet.with);
      SELECT
        CASE WHEN number_count > 0 AND with_count > 0 THEN bet.amount * 336 * with_count ELSE 0 END AS payout,
        with_count AS hits
      INTO result;
    ELSE
      SELECT 0 AS payout, 0 AS hits INTO result;
    END IF;
  ELSIF bet.place IN ('FIVE', 'TEN', 'TWENTY') THEN
    IF bet.place = 'FIVE' AND bet.position = 'FIVE' THEN
      SELECT
        COUNT(*) FILTER (WHERE ends_with(r, bet.number))::INT AS nc,
        COUNT(*) FILTER (WHERE ends_with(r, bet.with))::INT AS wc
      INTO number_count, with_count
      FROM unnest(results[1:5]) AS r;
      SELECT
        CASE WHEN number_count > 0 AND with_count > 0 THEN bet.amount * 256 * GREATEST(number_count, with_count) ELSE 0 END AS payout,
        GREATEST(number_count, with_count) AS hits
      INTO result;
    ELSIF bet.place = 'FIVE' AND bet.position = 'TEN' THEN
      SELECT COUNT(*)::INT INTO number_count FROM unnest(results[1:5]) AS r WHERE ends_with(r, bet.number);
      SELECT COUNT(*)::INT INTO with_count FROM unnest(results[1:10]) AS r WHERE ends_with(r, bet.with);
      SELECT
        CASE WHEN number_count > 0 AND with_count > 0 THEN bet.amount * 128 * GREATEST(number_count, with_count) ELSE 0 END AS payout,
        GREATEST(number_count, with_count) AS hits
      INTO result;
    ELSIF bet.place = 'FIVE' AND bet.position = 'TWENTY' THEN
      SELECT COUNT(*)::INT INTO number_count FROM unnest(results[1:5]) AS r WHERE ends_with(r, bet.number);
      SELECT COUNT(*)::INT INTO with_count FROM unnest(results[1:20]) AS r WHERE ends_with(r, bet.with);
      SELECT
        CASE WHEN number_count > 0 AND with_count > 0 THEN bet.amount * 128 * GREATEST(number_count, with_count) ELSE 0 END AS payout,
        GREATEST(number_count, with_count) AS hits
      INTO result;
    ELSIF bet.place = 'TEN' AND bet.position = 'TEN' THEN
      SELECT
        COUNT(*) FILTER (WHERE ends_with(r, bet.number))::INT AS nc,
        COUNT(*) FILTER (WHERE ends_with(r, bet.with))::INT AS wc
      INTO number_count, with_count
      FROM unnest(results[1:10]) AS r;
      SELECT
        CASE WHEN number_count > 0 AND with_count > 0 THEN bet.amount * 64 * GREATEST(number_count, with_count) ELSE 0 END AS payout,
        GREATEST(number_count, with_count) AS hits
      INTO result;
    ELSIF bet.place = 'TEN' AND bet.position = 'TWENTY' THEN
      SELECT COUNT(*)::INT INTO number_count FROM unnest(results[1:10]) AS r WHERE ends_with(r, bet.number);
      SELECT COUNT(*)::INT INTO with_count FROM unnest(results[1:20]) AS r WHERE ends_with(r, bet.with);
      SELECT
        CASE WHEN number_count > 0 AND with_count > 0 THEN bet.amount * 32 * GREATEST(number_count, with_count) ELSE 0 END AS payout,
        GREATEST(number_count, with_count) AS hits
      INTO result;
    ELSIF bet.place = 'TWENTY' AND bet.position = 'TWENTY' THEN
      SELECT
        COUNT(*) FILTER (WHERE ends_with(r, bet.number))::INT AS nc,
        COUNT(*) FILTER (WHERE ends_with(r, bet.with))::INT AS wc
      INTO number_count, with_count
      FROM unnest(results[1:20]) AS r;
      SELECT
        CASE WHEN number_count > 0 AND with_count > 0 THEN bet.amount * 16 * GREATEST(number_count, with_count) ELSE 0 END AS payout,
        GREATEST(number_count, with_count) AS hits
      INTO result;
    ELSE
      SELECT 0 AS payout, 0 AS hits INTO result;
    END IF;
  ELSE
    SELECT 0 AS payout, 0 AS hits INTO result;
  END IF;
  RETURN result;
END;
$$;


DROP FUNCTION IF EXISTS generate_winners(UUID, DATE);

CREATE OR REPLACE FUNCTION generate_winners(target_id UUID, bet_date DATE)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Paso 1: Usar un CTE para calcular los premios de todas las apuestas relevantes de una sola vez.
    -- Esto reemplaza completamente el bucle y las llamadas individuales a funciones.
    WITH calculated_payouts AS (
        SELECT
            b.bet_id,
            b.ticket_id,
            -- El CASE llama a la función de cálculo apropiada para cada fila.
            -- El '( ... ).*' expande el tipo de dato RECORD devuelto por la función
            -- en sus columnas constituyentes (payout, hits).
            (CASE b.bet_type
                WHEN 'ONE'       THEN calculate_one_payout(b, r.results)
                WHEN 'DOUBLE'    THEN calculate_double_payout(b, r.results)
                WHEN 'TERN'      THEN calculate_tern_payout(b, r.results)
                WHEN 'QUATERN'   THEN calculate_quatern_payout(b, r.results)
                WHEN 'BORRATINA' THEN calculate_borratina_payout(b, r.results)
                WHEN 'REDOUBLE'  THEN calculate_redouble_payout(b, r.results)
                -- Devolvemos un RECORD con la estructura correcta para los no ganadores
                ELSE ROW(0::NUMERIC, 0::INTEGER)
            END).* AS (payout, hits) -- Nombrar las columnas resultantes
        FROM
            bets b
        JOIN
            results r ON b.lottery_id = r.lottery_id
                      AND b.schedule_id = r.schedule_id
                      AND b.date = r.date
        WHERE
            b.schedule_id = target_id
            AND b.date = bet_date
            AND b.deleted_at IS NULL
    ),
    -- Paso 2: Actualizar la tabla de apuestas (bets) en una sola operación masiva.
    updated_bets AS (
        UPDATE bets b
        SET
            winner = true,
            prize = cp.payout,
            hits = cp.hits
        FROM
            calculated_payouts cp
        WHERE
            b.bet_id = cp.bet_id
            AND cp.payout > 0
    ),
    -- Paso 3: Pre-agregar los totales por ticket para evitar subconsultas correlacionadas.
    ticket_summary AS (
        SELECT
            ticket_id,
            SUM(payout) AS total_prize,
            SUM(hits) AS total_hits
        FROM
            calculated_payouts
        WHERE
            payout > 0
        GROUP BY
            ticket_id
    )
    -- Paso 4: Actualizar la tabla de tickets en una sola operación masiva.
    UPDATE tickets t
    SET
        winner = true,
        total_prize = ts.total_prize,
        hits = ts.total_hits
    FROM
        ticket_summary ts
    WHERE
        t.ticket_id = ts.ticket_id;

END;
$$;