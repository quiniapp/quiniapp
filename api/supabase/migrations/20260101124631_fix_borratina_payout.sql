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
  num_text    TEXT;
  match_count INT := 0;
BEGIN
  -- preserva ceros a la izquierda (ej: 0103557148)
  num_text := lpad(bet.number::text, 10, '0');

  -- si no hay resultados, no hay aciertos
  IF results IS NULL OR array_length(results, 1) IS NULL THEN
    hits := 0;
    payout := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  WITH bet_pairs AS (
    -- pares jugados (10 dígitos => 5 pares)
    SELECT substring(num_text FROM (i - 1) * 2 + 1 FOR 2) AS pair
    FROM generate_series(1, length(num_text) / 2) AS gs(i)
  ),
  res_pairs AS (
    -- últimos 2 dígitos de los resultados (solo 1..18)
    SELECT right(r, 2) AS pair
    FROM unnest(results[1:18]) AS r
  ),
  bet_counts AS (
    SELECT pair, count(*)::int AS c
    FROM bet_pairs
    GROUP BY pair
  ),
  res_counts AS (
    SELECT pair, count(*)::int AS c
    FROM res_pairs
    GROUP BY pair
  )
  SELECT COALESCE(sum(LEAST(b.c, COALESCE(r.c, 0))), 0)::int
    INTO match_count
  FROM bet_counts b
  LEFT JOIN res_counts r USING (pair);

  hits := match_count;

  IF match_count >= 5 THEN
    payout := bet.amount * 1200;
  ELSIF match_count = 4 THEN
    payout := bet.amount * 80;
  ELSIF match_count = 3 THEN
    payout := bet.amount * 8;
  ELSE
    payout := 0;
  END IF;

  RETURN NEXT;
END;
$$;
