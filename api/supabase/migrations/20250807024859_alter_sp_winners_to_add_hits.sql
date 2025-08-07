-- Para la cláusula WHERE y el JOIN principal
CREATE INDEX IF NOT EXISTS idx_bets_schedule_date ON bets (schedule_id, date);
CREATE INDEX IF NOT EXISTS idx_results_schedule_date ON results (schedule_id, date);

-- Para los JOINs y las actualizaciones
CREATE INDEX IF NOT EXISTS idx_bets_ticket_id ON bets (ticket_id);
CREATE INDEX IF NOT EXISTS idx_bets_lottery_id ON bets (lottery_id);
CREATE INDEX IF NOT EXISTS idx_results_lottery_id ON results (lottery_id);


-- Función para apuesta 'ONE' (sin cambios, ya era óptima)
DROP FUNCTION IF EXISTS calculate_one_payout(RECORD, TEXT[]);
CREATE OR REPLACE FUNCTION calculate_one_payout(
  bet RECORD,
  results TEXT[]
)
RETURNS TABLE(
  payout NUMERIC,
  hits   INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  is_winner BOOLEAN := (bet.place = 'HEAD' AND ends_with(results[1], bet.number));
BEGIN
  -- Usamos RETURN QUERY para devolver una sola fila
  RETURN QUERY
  SELECT
    CASE WHEN is_winner THEN 7 * bet.amount ELSE 0 END,
    CASE WHEN is_winner THEN 1            ELSE 0 END;
END;
$$;


-- Función para apuesta 'DOUBLE' (refactorizada y corregida)
DROP FUNCTION IF EXISTS calculate_double_payout(RECORD, TEXT[]);
CREATE OR REPLACE FUNCTION calculate_double_payout(
  bet     RECORD,
  results TEXT[]
)
RETURNS TABLE(
  payout NUMERIC,
  hits   INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  is_head      BOOLEAN := (bet.place = 'HEAD' AND ends_with(results[1], bet.number));
  multiplier   NUMERIC;
  slice_limit  INT;
  cnt          INT;
BEGIN
  IF is_head THEN
    -- Caso HEAD: un solo valor
    payout := 70 * bet.amount;
    hits   := 1;
  
  ELSE
    -- Determinamos el multiplicador y cuántos resultados mirar
    multiplier  := CASE bet.place
                     WHEN 'FIVE'   THEN 14
                     WHEN 'TEN'    THEN 7
                     WHEN 'TWENTY' THEN 3.5
                     ELSE 0
                   END;
    slice_limit := CASE bet.place
                     WHEN 'FIVE'   THEN 5
                     WHEN 'TEN'    THEN 10
                     WHEN 'TWENTY' THEN 20
                     ELSE 0
                   END;

    IF slice_limit > 0 THEN
      -- Contamos las ocurrencias sólo una vez
      SELECT COUNT(*) INTO cnt
      FROM unnest(results[1:slice_limit]) AS r
      WHERE ends_with(r, bet.number);

      payout := cnt * multiplier * bet.amount;
      hits   := cnt;
    ELSE
      payout := 0;
      hits   := 0;
    END IF;
  END IF;

  -- Emitimos la fila resultante
  RETURN NEXT;
END;
$$;


-- Función para apuesta 'TERN' (refactorizada y corregida)
DROP FUNCTION IF EXISTS calculate_tern_payout(RECORD, TEXT[]);
CREATE OR REPLACE FUNCTION calculate_tern_payout(
  bet     RECORD,
  results TEXT[]
)
RETURNS TABLE(
  payout NUMERIC,
  hits   INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  -- 1. Evaluamos una sola vez si es HEAD ganador
  is_head     BOOLEAN := (bet.place = 'HEAD' AND ends_with(results[1], bet.number));
  -- 2. Variables para el resto de casos
  multiplier  NUMERIC;
  slice_limit INT;
  cnt         INT;
BEGIN
  IF is_head THEN
    -- HEAD paga 600×amount y 1 acierto
    payout := 600 * bet.amount;
    hits   := 1;
  ELSE
    -- Determinamos el multiplicador y cuántos resultados mirar
    multiplier  := CASE bet.place
                     WHEN 'FIVE'   THEN 120
                     WHEN 'TEN'    THEN 60
                     WHEN 'TWENTY' THEN 30
                     ELSE 0
                   END;
    slice_limit := CASE bet.place
                     WHEN 'FIVE'   THEN 5
                     WHEN 'TEN'    THEN 10
                     WHEN 'TWENTY' THEN 20
                     ELSE 0
                   END;

    IF slice_limit > 0 THEN
      -- Contamos ocurrencias una sola vez
      SELECT COUNT(*) INTO cnt
      FROM unnest(results[1:slice_limit]) AS r
      WHERE ends_with(r, bet.number);

      payout := cnt * multiplier * bet.amount;
      hits   := cnt;
    ELSE
      payout := 0;
      hits   := 0;
    END IF;
  END IF;

  -- Emitimos exactamente una fila con los valores de salida
  RETURN NEXT;
END;
$$;


-- Función para apuesta 'QUATERN' (refactorizada y corregida)
DROP FUNCTION IF EXISTS calculate_quatern_payout(RECORD, TEXT[]);
CREATE OR REPLACE FUNCTION calculate_quatern_payout(
  bet     RECORD,
  results TEXT[]
)
RETURNS TABLE(
  payout NUMERIC,
  hits   INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  -- Pre-calcula el caso HEAD (coincidencia exacta en la primer posición)
  is_head     BOOLEAN := (bet.place = 'HEAD' AND results[1] = bet.number);
  multiplier  NUMERIC;
  slice_limit INT;
  cnt         INT;
BEGIN
  IF is_head THEN
    -- HEAD paga 3500×amount y 1 acierto
    payout := 3500 * bet.amount;
    hits   := 1;
  ELSE
    -- Determina multiplicador y cuántos resultados chequear
    multiplier  := CASE bet.place
                     WHEN 'FIVE'   THEN 700
                     WHEN 'TEN'    THEN 350
                     WHEN 'TWENTY' THEN 175
                     ELSE 0
                   END;
    slice_limit := CASE bet.place
                     WHEN 'FIVE'   THEN 5
                     WHEN 'TEN'    THEN 10
                     WHEN 'TWENTY' THEN 20
                     ELSE 0
                   END;

    IF slice_limit > 0 THEN
      -- Cuenta las ocurrencias en el slice
      SELECT COUNT(*) INTO cnt
      FROM unnest(results[1:slice_limit]) AS r
      WHERE r = bet.number;

      payout := cnt * multiplier * bet.amount;
      hits   := cnt;
    ELSE
      payout := 0;
      hits   := 0;
    END IF;
  END IF;

  -- Devuelve la fila construida
  RETURN NEXT;
END;
$$;


-- Función para apuesta 'BORRATINA' (sin cambios)
DROP FUNCTION IF EXISTS calculate_borratina_payout(RECORD, TEXT[]);
CREATE OR REPLACE FUNCTION calculate_borratina_payout(
  bet     RECORD,
  results TEXT[]
)
RETURNS TABLE(
  payout NUMERIC,
  hits   INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  match_count INT;
BEGIN
  -- 1. Contamos las subcadenas de 2 dígitos que coinciden con los 2 últimos dígitos de los resultados en el slice 1:18
  SELECT COUNT(*) 
    INTO match_count
  FROM generate_series(0, 4) AS i
  CROSS JOIN unnest(results[1:18]) AS r
  WHERE ends_with(r, substring(bet.number FROM i*2+1 FOR 2));

  -- 2. Asignamos payout según la cantidad de matches
  IF match_count >= 5 THEN
    payout := bet.amount * 1200;
  ELSIF match_count = 4 THEN
    payout := bet.amount * 80;
  ELSIF match_count = 3 THEN
    payout := bet.amount * 8;
  ELSE
    payout := 0;
  END IF;

  -- 3. Siempre devolvemos también el número de aciertos
  hits := match_count;

  -- Emitimos la fila resultante
  RETURN NEXT;
END;
$$;


-- Función para apuesta 'REDOUBLE' (refactorizada para máxima eficiencia)
DROP FUNCTION IF EXISTS calculate_redouble_payout(RECORD, TEXT[]);
CREATE OR REPLACE FUNCTION calculate_redouble_payout(
  bet     RECORD,
  results TEXT[]
)
RETURNS TABLE(
  payout NUMERIC,
  hits   INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  -- pre-cálculos de todas las combinaciones posibles
  number_in_head  INT := CASE
                          WHEN array_length(results, 1) >= 1
                           AND ends_with(results[1], bet.number)
                          THEN 1 ELSE 0
                        END;
  with_in_5       INT := (
                        SELECT COUNT(*)
                          FROM unnest(results[1:5]) AS r
                         WHERE ends_with(r, bet.with)
                        );
  with_in_10      INT := (
                        SELECT COUNT(*)
                          FROM unnest(results[1:10]) AS r
                         WHERE ends_with(r, bet.with)
                        );
  with_in_20      INT := (
                        SELECT COUNT(*)
                          FROM unnest(results[1:20]) AS r
                         WHERE ends_with(r, bet.with)
                        );
  number_in_5     INT := (
                        SELECT COUNT(*)
                          FROM unnest(results[1:5]) AS r
                         WHERE ends_with(r, bet.number)
                        );
  number_in_10    INT := (
                        SELECT COUNT(*)
                          FROM unnest(results[1:10]) AS r
                         WHERE ends_with(r, bet.number)
                        );
  number_in_20    INT := (
                        SELECT COUNT(*)
                          FROM unnest(results[1:20]) AS r
                         WHERE ends_with(r, bet.number)
                        );
BEGIN
  -- valores por defecto
  payout := 0;
  hits   := 0;

  IF number_in_head > 0 THEN
    -- Caso 1: el número principal salió de primero
    IF bet.position = 'FIVE'  AND with_in_5  > 0 THEN
      payout := bet.amount * 1280 * with_in_5;
      hits   := with_in_5;
    ELSIF bet.position = 'TEN'  AND with_in_10 > 0 THEN
      payout := bet.amount * 640  * with_in_10;
      hits   := with_in_10;
    ELSIF bet.position = 'TWENTY' AND with_in_20 > 0 THEN
      payout := bet.amount * 336  * with_in_20;
      hits   := with_in_20;
    END IF;

  ELSE
    -- Caso 2: el número principal no salió de primero
    IF bet.place = 'FIVE' AND number_in_5 > 0 THEN
      IF bet.position = 'FIVE'  AND with_in_5  > 0 THEN
        payout := bet.amount * 256  * GREATEST(number_in_5,  with_in_5);
        hits   := GREATEST(number_in_5,  with_in_5);
      ELSIF bet.position = 'TEN'   AND with_in_10 > 0 THEN
        payout := bet.amount * 128  * GREATEST(number_in_5,  with_in_10);
        hits   := GREATEST(number_in_5,  with_in_10);
      ELSIF bet.position = 'TWENTY' AND with_in_20 > 0 THEN
        payout := bet.amount * 128  * GREATEST(number_in_5,  with_in_20);
        hits   := GREATEST(number_in_5,  with_in_20);
      END IF;

    ELSIF bet.place = 'TEN' AND number_in_10 > 0 THEN
      IF bet.position = 'TEN'   AND with_in_10 > 0 THEN
        payout := bet.amount * 64   * GREATEST(number_in_10, with_in_10);
        hits   := GREATEST(number_in_10, with_in_10);
      ELSIF bet.position = 'TWENTY' AND with_in_20 > 0 THEN
        payout := bet.amount * 32   * GREATEST(number_in_10, with_in_20);
        hits   := GREATEST(number_in_10, with_in_20);
      END IF;

    ELSIF bet.place = 'TWENTY' AND number_in_20 > 0 THEN
      IF bet.position = 'TWENTY' AND with_in_20 > 0 THEN
        payout := bet.amount * 16   * GREATEST(number_in_20, with_in_20);
        hits   := GREATEST(number_in_20, with_in_20);
      END IF;
    END IF;
  END IF;

  -- devolvemos exactamente una fila
  RETURN NEXT;
END;
$$;



DROP FUNCTION IF EXISTS generate_winners(UUID, DATE);

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
            -- Cada rama del CASE ahora hace:
            --    (SELECT * FROM función_de_cálculo(...))
            -- que devuelve la fila (payout, hits)
            (CASE b.bet_type
               WHEN 'ONE'       THEN (SELECT (payout, hits) FROM calculate_one_payout(b, r.results))
               WHEN 'DOUBLE'    THEN (SELECT (payout, hits) FROM calculate_double_payout(b, r.results))
               WHEN 'TERN'      THEN (SELECT (payout, hits) FROM calculate_tern_payout(b, r.results))
               WHEN 'QUATERN'   THEN (SELECT (payout, hits) FROM calculate_quatern_payout(b, r.results))
               WHEN 'BORRATINA' THEN (SELECT (payout, hits) FROM calculate_borratina_payout(b, r.results))
               WHEN 'REDOUBLE'  THEN (SELECT (payout, hits) FROM calculate_redouble_payout(b, r.results))
               ELSE ROW(0::NUMERIC, 0::INTEGER)
             END) AS result
        FROM
            bets b
        JOIN
            results r
          ON b.lottery_id  = r.lottery_id
         AND b.schedule_id = r.schedule_id
         AND b.date        = r.date
        WHERE
            b.schedule_id = target_id
          AND b.date        = bet_date
          AND b.deleted_at IS NULL
    ),
    calculated_payouts_expanded AS (
        SELECT
            bet_id,
            ticket_id,
            (result).payout AS payout,
            (result).hits AS hits
        FROM calculated_payouts
    ),
    updated_bets AS (
        UPDATE bets b
           SET winner = true,
               prize  = cp.payout,
               hits   = cp.hits
          FROM calculated_payouts_expanded cp
         WHERE b.bet_id = cp.bet_id
           AND cp.payout > 0
         RETURNING b.ticket_id
    ),
    ticket_summary AS (
        SELECT
            ticket_id,
            SUM(payout) AS total_prize,
            SUM(hits)   AS total_hits
        FROM calculated_payouts_expanded
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
