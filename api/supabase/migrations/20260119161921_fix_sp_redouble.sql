-- Función para apuesta 'REDOUBLE' (ajuste de pago cuando number = with)
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
                   WHEN 'HEAD'    THEN 1     -- solo la primera posición
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
  -- 4) Validar condiciones de pago según si number y with son iguales
  ----------------------------------------------------------------------
  IF bet.number = bet.with THEN
    -- Caso especial: cuando number y with son iguales, necesitamos
    -- al menos 2 ocurrencias del mismo número para que pague
    IF number_hits = 0 OR with_hits < 2 THEN
      RETURN NEXT;
    END IF;
  ELSE
    -- Caso normal: cuando son diferentes, cada uno debe salir al menos una vez
    IF number_hits = 0 OR with_hits = 0 THEN
      RETURN NEXT;
    END IF;
  END IF;

  ----------------------------------------------------------------------
  -- 5) Definir multiplicador según combinación (place, position)
  ----------------------------------------------------------------------
  multiplier := CASE
                  WHEN bet.place = 'HEAD'    AND bet.position = 'FIVE'   THEN 1280
                  WHEN bet.place = 'HEAD'    AND bet.position = 'TEN'    THEN 640
                  WHEN bet.place = 'HEAD'    AND bet.position = 'TWENTY' THEN 336

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
  IF bet.number = bet.with THEN
    -- Cuando son iguales, restamos 1 porque necesitamos 2 ocurrencias base
    hits := GREATEST(number_hits, with_hits) - 1;
  ELSE
    -- Cuando son diferentes, pagamos por todas las ocurrencias
    hits := GREATEST(number_hits, with_hits);
  END IF;

  payout := bet.amount * multiplier * hits;

  ----------------------------------------------------------------------
  -- 7) Devolvemos una sola fila
  ----------------------------------------------------------------------
  RETURN NEXT;
END;
$$;
