-- Polla: números repetidos y aciertos por casillero con fecha.
--
-- Una jugada puede repetir números (el 32 cinco veces). Cada aparición es un
-- casillero que necesita su propia salida del 32 a lo largo de la edición: las
-- 5 en un mismo sorteo o repartidas (2 un día, 0 otro, 3 otro).
--
-- hit_dates va en paralelo a numbers: hit_dates[i] es el día en que acertó el
-- casillero i (NULL = todavía no). Guardar el día permite reprocesar un sorteo
-- corregido deshaciendo solo sus marcas, sin tocar las de los otros días.
-- hits y hit_numbers quedan como derivados de hit_dates.

-- ============================================================
-- 1. Números: solo formato, se permiten repetidos
-- ============================================================

DROP TRIGGER IF EXISTS trg_validate_polla_bet_numbers ON polla_bets;
DROP FUNCTION IF EXISTS validate_polla_bet_numbers_distinct();

CREATE FUNCTION validate_polla_bet_numbers()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(NEW.numbers) n WHERE n IS NULL OR n !~ '^\d{2}$') THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_INVALID';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION validate_polla_bet_numbers() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_validate_polla_bet_numbers
  BEFORE INSERT OR UPDATE OF numbers ON polla_bets
  FOR EACH ROW EXECUTE FUNCTION validate_polla_bet_numbers();

-- ============================================================
-- 2. Aciertos por casillero
-- ============================================================

ALTER TABLE polla_bets
  ADD COLUMN hit_dates DATE[] NOT NULL DEFAULT array_fill(NULL::DATE, ARRAY[10]),
  ADD CONSTRAINT polla_bets_hit_dates_length CHECK (array_length(hit_dates, 1) = 10);

-- Backfill: hasta acá los números eran distintos y hit_numbers marcaba cada uno
-- una sola vez. Se le pone a cada casillero acertado el primer sorteo de la
-- edición en que salió ese número. hits, winner, prize y el estado de la
-- edición no se tocan: no cambia ningún monto.
WITH slots AS (
  SELECT
    b.polla_bet_id,
    s.idx,
    s.n,
    s.n = ANY (b.hit_numbers) AS was_hit,
    b.hit_date,
    e.start_date,
    e.end_date,
    e.polla_organization_id,
    e.polla_lottery_id,
    e.polla_schedule_id
  FROM polla_bets b
  JOIN polla_editions e ON e.polla_edition_id = b.polla_edition_id
  CROSS JOIN LATERAL unnest(b.numbers) WITH ORDINALITY AS s(n, idx)
  WHERE cardinality(b.hit_numbers) > 0
),
dated AS (
  SELECT
    sl.polla_bet_id,
    sl.idx,
    CASE
      WHEN sl.was_hit THEN COALESCE(
        (
          SELECT MIN(r.date)
          FROM polla_results r
          WHERE r.polla_organization_id = sl.polla_organization_id
            AND r.polla_lottery_id = sl.polla_lottery_id
            AND r.polla_schedule_id = sl.polla_schedule_id
            AND r.deleted_at IS NULL
            AND r.date BETWEEN sl.start_date AND sl.end_date
            AND EXISTS (SELECT 1 FROM unnest(r.results) x WHERE RIGHT(x, 2) = sl.n)
        ),
        sl.hit_date,
        sl.start_date
      )
    END AS hit_day
  FROM slots sl
)
UPDATE polla_bets b
SET hit_dates = agg.hit_dates
FROM (
  SELECT polla_bet_id, array_agg(hit_day ORDER BY idx) AS hit_dates
  FROM dated
  GROUP BY polla_bet_id
) agg
WHERE b.polla_bet_id = agg.polla_bet_id;

-- ============================================================
-- 3. Índices
-- ============================================================

-- Ranking de aciertos con keyset (hits, created_at, id). Su prefijo cubre el
-- índice de aciertos anterior.
CREATE INDEX idx_polla_bets_edition_ranking
  ON polla_bets (polla_edition_id, hits DESC, created_at DESC, polla_bet_id DESC)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_polla_bets_edition_hits;

-- El procesamiento ya no filtra por winner = FALSE: reprocesar un día puede
-- revertir ganadores, así que recorre todas las jugadas de la edición.
DROP INDEX IF EXISTS idx_polla_bets_edition_pending;

-- ============================================================
-- 4. Edición de números: también limpia las marcas por casillero
-- ============================================================

DROP FUNCTION IF EXISTS polla_update_bet_numbers(UUID, TEXT[], UUID, BOOLEAN);

CREATE FUNCTION polla_update_bet_numbers(
  p_bet_id UUID,
  p_numbers TEXT[],
  p_actor_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bet polla_bets;
  v_edition polla_editions;
BEGIN
  IF array_length(p_numbers, 1) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_MUST_BE_TEN';
  END IF;

  SELECT * INTO v_bet
  FROM polla_bets
  WHERE polla_bet_id = p_bet_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_BET_NOT_FOUND';
  END IF;

  IF v_bet.winner THEN
    RAISE EXCEPTION 'POLLA_BET_ALREADY_WINNER';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = v_bet.polla_edition_id;

  IF CURRENT_DATE > v_edition.load_limit_date AND NOT p_force THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  UPDATE polla_bets
  SET numbers = p_numbers,
      hit_numbers = '{}',
      hit_dates = array_fill(NULL::DATE, ARRAY[10]),
      hits = 0
  WHERE polla_bet_id = p_bet_id
  RETURNING * INTO v_bet;

  RETURN jsonb_build_object('success', true, 'bet', to_jsonb(v_bet));
END;
$$;

REVOKE ALL ON FUNCTION polla_update_bet_numbers(UUID, TEXT[], UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_update_bet_numbers(UUID, TEXT[], UUID, BOOLEAN) TO service_role;

-- ============================================================
-- 5. Procesamiento de aciertos de un día
-- ============================================================
--
-- Reprocesar el día D es idempotente:
--   * libera solo los casilleros marcados con D y los vuelve a asignar con los
--     resultados actuales de D (si se borró el resultado, D queda sin aciertos);
--   * las marcas de los otros días no se tocan;
--   * los ganadores se derivan siempre de las marcas: una jugada se completa el
--     día de su último acierto y gana quien se completó primero. Así, corregir
--     un resultado que había generado un ganador lo revierte y reabre la edición.

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
    -- Últimas 2 cifras, contando repetidos: si el 32 sale dos veces entre los
    -- 20 números, llena dos casilleros con 32.
    SELECT RIGHT(r, 2) AS n, COUNT(*) AS k
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

-- ============================================================
-- 6. Orquestador del día
-- ============================================================

DROP FUNCTION IF EXISTS polla_process_results_and_accounts(UUID, UUID, DATE);

CREATE FUNCTION polla_process_results_and_accounts(
  p_organization_id UUID,
  p_schedule_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lottery RECORD;
  v_processed JSONB;
  v_results JSONB[] := '{}';
  v_dates DATE[] := ARRAY[p_date];
  v_date DATE;
  v_accounts JSONB[];
  v_accounts_updated INTEGER := 0;
BEGIN
  -- Se recorren las ediciones del turno que cubren el día, no los resultados:
  -- si se borró un resultado mal cargado, reprocesar igual limpia sus aciertos.
  FOR v_lottery IN
    SELECT DISTINCT polla_lottery_id
    FROM polla_editions
    WHERE polla_organization_id = p_organization_id
      AND polla_schedule_id = p_schedule_id
      AND p_date BETWEEN start_date AND end_date
      AND deleted_at IS NULL
  LOOP
    v_processed := polla_process_edition_hits(
      p_organization_id,
      v_lottery.polla_lottery_id,
      p_schedule_id,
      p_date
    );
    v_results := v_results || v_processed;

    -- El premio se imputa en la cuenta corriente del día ganador: si el
    -- reproceso movió o revirtió un ganador, esos días también se recalculan.
    IF v_processed->>'winner_date' IS NOT NULL THEN
      v_dates := v_dates || (v_processed->>'winner_date')::DATE;
    END IF;

    IF v_processed->>'previous_winner_date' IS NOT NULL THEN
      v_dates := v_dates || (v_processed->>'previous_winner_date')::DATE;
    END IF;
  END LOOP;

  FOR v_date IN SELECT DISTINCT d FROM unnest(v_dates) d ORDER BY d LOOP
    v_accounts := polla_calculate_current_account(
      to_char(v_date, 'DD-MM-YYYY'),
      FALSE,
      FALSE,
      p_organization_id
    );
    v_accounts_updated := v_accounts_updated + COALESCE(array_length(v_accounts, 1), 0);

    -- Si el día es pasado, el saldo nuevo se arrastra a los días siguientes.
    PERFORM polla_cascade_current_account_from_date(
      to_char(v_date, 'DD-MM-YYYY'),
      p_organization_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'polla_organization_id', p_organization_id,
    'polla_schedule_id', p_schedule_id,
    'date', p_date,
    'editions', to_jsonb(v_results),
    'accounts_updated', v_accounts_updated
  );
END;
$$;

ALTER FUNCTION polla_process_results_and_accounts(UUID, UUID, DATE)
  SET statement_timeout = '300000';

REVOKE ALL ON FUNCTION polla_process_results_and_accounts(UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_process_results_and_accounts(UUID, UUID, DATE) TO service_role;

ANALYZE polla_bets;
