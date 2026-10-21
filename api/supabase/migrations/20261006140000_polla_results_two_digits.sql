-- Polla: los resultados se cargan con 2 cifras.
--
-- Antes se cargaban los 20 números de la quiniela con 4 cifras y el
-- procesamiento se quedaba con las 2 últimas. Ahora se cargan directamente las
-- 2 cifras que se comparan con los números jugados (00 a 99).
--
-- * Los resultados ya cargados se pasan a sus 2 últimas cifras: es lo mismo
--   que usaba el procesamiento, así que no cambia ningún acierto.
-- * Un trigger valida que cada resultado tenga 2 cifras.
-- * polla_process_edition_hits compara cada resultado tal cual, sin RIGHT().

-- ============================================================
-- 1. Resultados existentes: sus 2 últimas cifras
-- ============================================================

UPDATE polla_results r
SET results = ARRAY(
      SELECT RIGHT(n, 2)
      FROM unnest(r.results) WITH ORDINALITY AS t(n, idx)
      ORDER BY idx
    ),
    edited_at = NOW()
WHERE EXISTS (SELECT 1 FROM unnest(r.results) n WHERE n !~ '^\d{2}$');

-- ============================================================
-- 2. Formato: 20 números de 2 cifras
-- ============================================================

DROP TRIGGER IF EXISTS trg_validate_polla_result_numbers ON polla_results;
DROP FUNCTION IF EXISTS validate_polla_result_numbers();

CREATE FUNCTION validate_polla_result_numbers()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(NEW.results) n WHERE n IS NULL OR n !~ '^\d{2}$') THEN
    RAISE EXCEPTION 'POLLA_RESULTS_INVALID';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION validate_polla_result_numbers() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_validate_polla_result_numbers
  BEFORE INSERT OR UPDATE OF results ON polla_results
  FOR EACH ROW EXECUTE FUNCTION validate_polla_result_numbers();

-- ============================================================
-- 3. Procesamiento: comparación directa
-- ============================================================
--
-- Igual que en 20261005120000; solo cambia cómo se arma `drawn`.

DROP FUNCTION IF EXISTS polla_process_edition_hits(UUID, UUID, UUID, DATE);

CREATE FUNCTION polla_process_edition_hits(
  p_organization_id UUID,
  p_lottery_id UUID,
  p_schedule_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
  v_results TEXT[];
  v_updated INTEGER := 0;
  v_winner_date DATE;
  v_winner_count INTEGER := 0;
  v_prize NUMERIC(12,2) := 0;
  v_status polla_edition_status_enum;
BEGIN
  -- Una edición que ya tuvo ganador antes de D terminó: los días siguientes no
  -- la afectan. Si el ganador es de D o posterior, D todavía puede cambiarlo.
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_organization_id = p_organization_id
    AND polla_lottery_id = p_lottery_id
    AND polla_schedule_id = p_schedule_id
    AND p_date BETWEEN start_date AND end_date
    AND deleted_at IS NULL
    AND NOT (status = 'FINISHED' AND winner_date IS NOT NULL AND winner_date < p_date)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'NO_ACTIVE_EDITION');
  END IF;

  SELECT results INTO v_results
  FROM polla_results
  WHERE polla_organization_id = p_organization_id
    AND polla_lottery_id = p_lottery_id
    AND polla_schedule_id = p_schedule_id
    AND date = p_date
    AND deleted_at IS NULL;

  v_results := COALESCE(v_results, '{}');

  WITH drawn AS (
    -- Los resultados ya son de 2 cifras y se comparan tal cual con los números
    -- jugados, contando repetidos: si el 32 sale dos veces entre los 20
    -- números, llena dos casilleros con 32.
    SELECT r AS n, COUNT(*) AS k
    FROM unnest(v_results) r
    GROUP BY 1
  ),
  slots AS (
    SELECT
      b.polla_bet_id,
      s.idx,
      s.n,
      NULLIF(b.hit_dates[s.idx], p_date) AS kept
    FROM polla_bets b
    CROSS JOIN LATERAL unnest(b.numbers) WITH ORDINALITY AS s(n, idx)
    WHERE b.polla_edition_id = v_edition.polla_edition_id
      AND b.deleted_at IS NULL
  ),
  ranked AS (
    SELECT
      sl.polla_bet_id,
      sl.idx,
      sl.n,
      sl.kept,
      d.k,
      ROW_NUMBER() OVER (
        PARTITION BY sl.polla_bet_id, sl.n, sl.kept IS NULL
        ORDER BY sl.idx
      ) AS rn
    FROM slots sl
    LEFT JOIN drawn d ON d.n = sl.n
  ),
  computed AS (
    SELECT
      polla_bet_id,
      array_agg(
        CASE
          WHEN kept IS NOT NULL THEN kept
          WHEN rn <= k THEN p_date
        END
        ORDER BY idx
      ) AS new_dates,
      array_agg(n ORDER BY idx) FILTER (WHERE kept IS NOT NULL OR rn <= k) AS new_hit_numbers
    FROM ranked
    GROUP BY polla_bet_id
  ),
  applied AS (
    UPDATE polla_bets b
    SET hit_dates = c.new_dates,
        hit_numbers = COALESCE(c.new_hit_numbers, '{}'),
        hits = COALESCE(cardinality(c.new_hit_numbers), 0)
    FROM computed c
    WHERE b.polla_bet_id = c.polla_bet_id
      AND b.hit_dates IS DISTINCT FROM c.new_dates
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_updated FROM applied;

  SELECT MIN(done) INTO v_winner_date
  FROM (
    SELECT (SELECT MAX(d) FROM unnest(b.hit_dates) d) AS done
    FROM polla_bets b
    WHERE b.polla_edition_id = v_edition.polla_edition_id
      AND b.deleted_at IS NULL
      AND b.hits >= 10
  ) completed;

  IF v_winner_date IS NOT NULL THEN
    SELECT COUNT(*) INTO v_winner_count
    FROM polla_bets b
    WHERE b.polla_edition_id = v_edition.polla_edition_id
      AND b.deleted_at IS NULL
      AND b.hits >= 10
      AND (SELECT MAX(d) FROM unnest(b.hit_dates) d) = v_winner_date;

    v_prize := ROUND(v_edition.pool_amount / v_winner_count, 2);
  END IF;

  UPDATE polla_bets b
  SET winner = w.is_winner,
      prize = CASE WHEN w.is_winner THEN v_prize ELSE 0 END,
      hit_date = CASE WHEN w.is_winner THEN v_winner_date END
  FROM (
    SELECT
      polla_bet_id,
      COALESCE(
        hits >= 10 AND (SELECT MAX(d) FROM unnest(hit_dates) d) = v_winner_date,
        FALSE
      ) AS is_winner
    FROM polla_bets
    WHERE polla_edition_id = v_edition.polla_edition_id
      AND deleted_at IS NULL
  ) w
  WHERE b.polla_bet_id = w.polla_bet_id
    AND (
      b.winner IS DISTINCT FROM w.is_winner
      OR b.prize IS DISTINCT FROM (CASE WHEN w.is_winner THEN v_prize ELSE 0 END)
      OR b.hit_date IS DISTINCT FROM (CASE WHEN w.is_winner THEN v_winner_date END)
    );

  v_status := CASE
    WHEN v_winner_date IS NOT NULL THEN 'FINISHED'
    WHEN p_date >= v_edition.end_date THEN 'FINISHED'
    -- Ya había cerrado sin ganador (se procesó el último día): corregir un día
    -- anterior que no genera ganador no la reabre.
    WHEN v_edition.status = 'FINISHED' AND v_edition.winner_date IS NULL THEN 'FINISHED'
    ELSE 'ACTIVE'
  END::polla_edition_status_enum;

  UPDATE polla_editions
  SET status = v_status,
      winner_date = v_winner_date,
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id
    AND (status IS DISTINCT FROM v_status OR winner_date IS DISTINCT FROM v_winner_date);

  RETURN jsonb_build_object(
    'success', true,
    'polla_edition_id', v_edition.polla_edition_id,
    'date', p_date,
    'bets_updated', v_updated,
    'winners', v_winner_count,
    'prize_per_winner', v_prize,
    'winner_date', v_winner_date,
    'previous_winner_date', v_edition.winner_date,
    -- La edición se reabrió: los días posteriores ya cargados hay que procesarlos.
    'reopened', v_edition.status = 'FINISHED' AND v_status = 'ACTIVE'
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_process_edition_hits(UUID, UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_process_edition_hits(UUID, UUID, UUID, DATE) TO service_role;
