-- R28: orden de las quinielas, que define cada organización (nada
-- hardcodeado: ni nombres ni orden por defecto).
--
-- - `polla_lotteries."order"` ya existía, pero todas estaban en 0 y por eso
--   salían en orden alfabético. Se normaliza a posiciones 1..N por
--   organización conservando el orden que se veía (orden, nombre).
-- - Una quiniela nueva va al final.
-- - `polla_reorder_lotteries` guarda el orden elegido en una sola operación.
-- - `polla_lottery_positions` da la posición (1..N entre las no borradas) y la
--   etiqueta "1 - Nacional" de cada quiniela de la organización.
-- - Los sorteos de cada edición (`polla_edition_with_draws`) suman
--   `lottery_position` y `lottery_label`, ordenados por horario del turno y
--   después por posición de la quiniela.

-- ------------------------------------------------------ normalizar

UPDATE polla_lotteries l
SET "order" = r.pos
FROM (
  SELECT
    polla_lottery_id,
    row_number() OVER (PARTITION BY polla_organization_id ORDER BY "order", name, polla_lottery_id) AS pos
  FROM polla_lotteries
  WHERE deleted_at IS NULL
) r
WHERE r.polla_lottery_id = l.polla_lottery_id;

COMMENT ON COLUMN polla_lotteries."order" IS
  'Posición de la quiniela en la organización (R28): define el orden y el número de "1 - Nacional".';

-- ------------------------------------------ una nueva va al final

CREATE OR REPLACE FUNCTION polla_lottery_default_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW."order" IS NULL OR NEW."order" <= 0 THEN
    SELECT COALESCE(MAX("order"), 0) + 1 INTO NEW."order"
    FROM polla_lotteries
    WHERE polla_organization_id = NEW.polla_organization_id
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION polla_lottery_default_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_polla_lottery_default_order ON polla_lotteries;
CREATE TRIGGER trg_polla_lottery_default_order
  BEFORE INSERT ON polla_lotteries
  FOR EACH ROW EXECUTE FUNCTION polla_lottery_default_order();

-- ------------------------------------------------------- reordenar

-- Recibe todas las quinielas (no borradas) de la organización en el orden
-- nuevo. Si falta alguna, sobra o se repite, no cambia nada.
CREATE OR REPLACE FUNCTION polla_reorder_lotteries(
  p_organization_id UUID,
  p_lottery_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current UUID[];
BEGIN
  -- Un reordenamiento por vez.
  PERFORM 1
  FROM polla_lotteries
  WHERE polla_organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  SELECT COALESCE(array_agg(polla_lottery_id ORDER BY polla_lottery_id), '{}')
  INTO v_current
  FROM polla_lotteries
  WHERE polla_organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF cardinality(p_lottery_ids) IS DISTINCT FROM cardinality(v_current)
     OR (SELECT COUNT(DISTINCT x) FROM unnest(p_lottery_ids) x) <> cardinality(v_current)
     OR (SELECT array_agg(x ORDER BY x) FROM unnest(p_lottery_ids) x) IS DISTINCT FROM v_current THEN
    RAISE EXCEPTION 'POLLA_LOTTERY_ORDER_INVALID';
  END IF;

  UPDATE polla_lotteries l
  SET "order" = o.pos,
      edited_at = NOW()
  FROM unnest(p_lottery_ids) WITH ORDINALITY AS o(id, pos)
  WHERE l.polla_lottery_id = o.id;
END;
$$;

REVOKE ALL ON FUNCTION polla_reorder_lotteries(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_reorder_lotteries(UUID, UUID[]) TO service_role;

-- ------------------------------------------------ posición y etiqueta

CREATE OR REPLACE FUNCTION polla_lottery_positions(p_organization_id UUID)
RETURNS TABLE (polla_lottery_id UUID, "position" INTEGER, label TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    r.polla_lottery_id,
    r.pos::INTEGER,
    r.pos || ' - ' || r.name
  FROM (
    SELECT
      l.polla_lottery_id,
      l.name,
      row_number() OVER (ORDER BY l."order", l.name, l.polla_lottery_id) AS pos
    FROM polla_lotteries l
    WHERE l.polla_organization_id = p_organization_id
      AND l.deleted_at IS NULL
  ) r;
$$;

REVOKE ALL ON FUNCTION polla_lottery_positions(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_lottery_positions(UUID) TO service_role;

-- La edición con sus sorteos: por horario del turno y después por posición de
-- la quiniela, con la posición y la etiqueta ("1 - Nacional"). Una quiniela
-- borrada no tiene posición: queda con su nombre, al final de su turno.
CREATE OR REPLACE FUNCTION polla_edition_with_draws(p_edition polla_editions)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_jsonb(p_edition) || jsonb_build_object(
    'draws',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'polla_lottery_id', d.polla_lottery_id,
            'polla_schedule_id', d.polla_schedule_id,
            'lottery_position', p."position",
            'lottery_label', COALESCE(p.label, l.name)
          )
          ORDER BY s.time, p."position" NULLS LAST, l.name
        )
        FROM polla_edition_draws d
        JOIN polla_lotteries l ON l.polla_lottery_id = d.polla_lottery_id
        JOIN polla_schedules s ON s.polla_schedule_id = d.polla_schedule_id
        LEFT JOIN polla_lottery_positions(p_edition.polla_organization_id) p
          ON p.polla_lottery_id = d.polla_lottery_id
        WHERE d.polla_edition_id = p_edition.polla_edition_id
      ),
      '[]'::JSONB
    )
  );
$$;

-- ROLLBACK:
-- DROP TRIGGER IF EXISTS trg_polla_lottery_default_order ON polla_lotteries;
-- DROP FUNCTION IF EXISTS polla_lottery_default_order();
-- DROP FUNCTION IF EXISTS polla_reorder_lotteries(UUID, UUID[]);
-- Volver a crear `polla_edition_with_draws` como en
-- 20261105090000_polla_edition_draws_min_hits.sql y después
-- DROP FUNCTION IF EXISTS polla_lottery_positions(UUID);
-- El "order" normalizado se puede dejar: con la versión anterior ordena igual.
