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
  place_limit    INT;
  position_limit INT;
  number_hits    INT := 0;
  with_hits      INT := 0;
  multiplier     NUMERIC := 0;
  should_pay     BOOLEAN := FALSE;
BEGIN
  payout := 0;
  hits   := 0;

  ----------------------------------------------------------------------
  -- 1) Rango para el número principal según place
  ----------------------------------------------------------------------
  place_limit := CASE bet.place
                   WHEN 'HEAD'   THEN 1
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

  ----------------------------------------------------------------------
  -- 3) Validar combinación válida
  ----------------------------------------------------------------------
  IF place_limit IS NOT NULL AND position_limit IS NOT NULL THEN

    --------------------------------------------------------------------------
    -- 4) Contar hits de number y with en sus respectivos rangos
    --------------------------------------------------------------------------
    SELECT COALESCE(COUNT(*), 0)
      INTO number_hits
    FROM unnest(results[1:place_limit]) AS r
    WHERE ends_with(r, bet.number);

    SELECT COALESCE(COUNT(*), 0)
      INTO with_hits
    FROM unnest(results[1:position_limit]) AS r
    WHERE ends_with(r, bet.with);

    --------------------------------------------------------------------------
    -- 5) Validar condiciones de pago según si number y with son iguales
    --------------------------------------------------------------------------
    IF bet.number = bet.with THEN
      IF bet.place = 'HEAD' THEN
        should_pay := (number_hits >= 1 AND with_hits >= 2);
      ELSE
        should_pay := (number_hits >= 2);
      END IF;
    ELSE
      -- ✅ AMBOS deben salir para que pague
      should_pay := (number_hits >= 1 AND with_hits >= 1);
    END IF;

    --------------------------------------------------------------------------
    -- 6) Solo calcular payout si debe pagar
    --------------------------------------------------------------------------
    IF should_pay THEN
      multiplier := CASE
                      WHEN bet.place = 'HEAD'   AND bet.position = 'FIVE'   THEN 1280
                      WHEN bet.place = 'HEAD'   AND bet.position = 'TEN'    THEN 640
                      WHEN bet.place = 'HEAD'   AND bet.position = 'TWENTY' THEN 336

                      WHEN bet.place = 'FIVE'   AND bet.position = 'FIVE'   THEN 256
                      WHEN bet.place = 'FIVE'   AND bet.position = 'TEN'    THEN 128
                      WHEN bet.place = 'FIVE'   AND bet.position = 'TWENTY' THEN 64

                      WHEN bet.place = 'TEN'    AND bet.position = 'TEN'    THEN 64
                      WHEN bet.place = 'TEN'    AND bet.position = 'TWENTY' THEN 32

                      WHEN bet.place = 'TWENTY' AND bet.position = 'TWENTY' THEN 16
                      ELSE 0
                    END;

      IF multiplier > 0 THEN
        ----------------------------------------------------------------------
        -- 7) Calcular hits para el pago
        ----------------------------------------------------------------------
        IF bet.number = bet.with THEN
          IF bet.place = 'HEAD' THEN
            hits := GREATEST(number_hits, with_hits) - 1;
          ELSIF bet.place = bet.position THEN
            hits := FLOOR(number_hits / 2.0)::INT;
          ELSE
            hits := LEAST(number_hits, with_hits - number_hits);
          END IF;
        ELSE
          hits := GREATEST(number_hits, with_hits);
        END IF;

        payout := bet.amount * multiplier * hits;
      END IF;
    END IF;

  END IF;

  RETURN NEXT;
END;
$$;
