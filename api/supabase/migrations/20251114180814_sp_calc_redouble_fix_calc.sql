-- Función para apuesta 'REDOUBLE' (refactor según reglas place/position)
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
  place_limit    INT;      -- hasta dónde miro el number
  position_limit INT;      -- hasta dónde miro el with
  number_hits    INT := 0; -- cuántas veces salió bet.number en su rango
  with_hits      INT := 0; -- cuántas veces salió bet.with en su rango
  multiplier     NUMERIC := 0;
BEGIN
  payout := 0;
  hits   := 0;

  ----------------------------------------------------------------------
  -- 1) Rango para el número principal según place
  ----------------------------------------------------------------------
  place_limit := CASE bet.place
                   WHEN 'ONE'    THEN 1     -- solo la primera posición
                   WHEN 'FIVE'   THEN 5
                   WHEN 'TEN'    THEN 10
                   WHEN 'TWENTY' THEN 20
                   ELSE NULL
                 END;

  ----------------------------------------------------------------------
  -- 2) Rango para el "with" según position
  ----------------------------------------------------------------------
  position_limit := CASE bet.position
                      WHEN 'FIVE'   THEN 5
                      WHEN 'TEN'    THEN 10
                      WHEN 'TWENTY' THEN 20
                      ELSE NULL
                    END;

  -- Si la combinación es inválida, no paga nada
  IF place_limit IS NULL OR position_limit IS NULL THEN
    RETURN NEXT;
  END IF;

  ----------------------------------------------------------------------
  -- 3) Contar hits de number y with en sus respectivos rangos
  ----------------------------------------------------------------------
  -- number: se busca solo dentro de 1..place_limit
  SELECT COALESCE(COUNT(*), 0)
    INTO number_hits
  FROM unnest(results[1:place_limit]) AS r
  WHERE ends_with(r, bet.number);

  -- with: se busca solo dentro de 1..position_limit
  SELECT COALESCE(COUNT(*), 0)
    INTO with_hits
  FROM unnest(results[1:position_limit]) AS r
  WHERE ends_with(r, bet.with);

  ----------------------------------------------------------------------
  -- 4) Si alguno de los dos no salió, la redoblona no paga
  ----------------------------------------------------------------------
  IF number_hits = 0 OR with_hits = 0 THEN
    RETURN NEXT;
  END IF;

  ----------------------------------------------------------------------
  -- 5) Definir multiplicador según combinación (place, position)
  ----------------------------------------------------------------------
  multiplier := CASE
                  WHEN bet.place = 'ONE'    AND bet.position = 'FIVE'   THEN 1280
                  WHEN bet.place = 'ONE'    AND bet.position = 'TEN'    THEN 640
                  WHEN bet.place = 'ONE'    AND bet.position = 'TWENTY' THEN 336

                  WHEN bet.place = 'FIVE'   AND bet.position = 'FIVE'   THEN 256
                  WHEN bet.place = 'FIVE'   AND bet.position = 'TEN'    THEN 128
                  WHEN bet.place = 'FIVE'   AND bet.position = 'TWENTY' THEN 64

                  WHEN bet.place = 'TEN'    AND bet.position = 'TEN'    THEN 64
                  WHEN bet.place = 'TEN'    AND bet.position = 'TWENTY' THEN 32

                  WHEN bet.place = 'TWENTY' AND bet.position = 'TWENTY' THEN 16
                  ELSE 0
                END;

  -- Si la combinación no tiene multiplicador definido, no paga
  IF multiplier <= 0 THEN
    RETURN NEXT;
  END IF;

  ----------------------------------------------------------------------
  -- 6) Paga el que más se repite entre number y with
  ----------------------------------------------------------------------
  hits   := GREATEST(number_hits, with_hits);
  payout := bet.amount * multiplier * hits;

  ----------------------------------------------------------------------
  -- 7) Devolvemos una sola fila
  ----------------------------------------------------------------------
  RETURN NEXT;
END;
$$;
