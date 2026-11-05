-- R27: dos ediciones en la misma semana (por ejemplo, la regular y la especial
-- del sábado).
--
-- 1. Se borra `no_overlapping_polla_editions`: dos ediciones de la misma
--    quiniela y turno pueden cubrir los mismos días. Cada ticket ya queda atado
--    a su edición (`polla_bets.polla_edition_id`).
-- 2. `polla_process_edition_hits` recibe la edición en lugar de quiniela, turno
--    y fecha. Antes buscaba "la" edición de ese sorteo: con dos solapadas
--    procesaba una sola.
-- 3. `polla_process_results_and_accounts` procesa todas las ediciones del turno
--    que cubren el día, una por una.
--
-- La regla de premio no cambia acá (la cambia R26 en la migración siguiente).

ALTER TABLE polla_editions DROP CONSTRAINT IF EXISTS no_overlapping_polla_editions;

DROP FUNCTION IF EXISTS polla_process_edition_hits(UUID, UUID, UUID, DATE);

CREATE OR REPLACE FUNCTION polla_process_edition_hits(p_edition_id UUID, p_date DATE)
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
  WHERE polla_edition_id = p_edition_id
    AND p_date BETWEEN start_date AND end_date
    AND deleted_at IS NULL
    AND NOT (status = 'FINISHED' AND winner_date IS NOT NULL AND winner_date < p_date)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'polla_edition_id', p_edition_id,
      'skipped', true,
      'reason', 'NO_ACTIVE_EDITION'
    );
  END IF;

  SELECT results INTO v_results
  FROM polla_results
  WHERE polla_organization_id = v_edition.polla_organization_id
    AND polla_lottery_id = v_edition.polla_lottery_id
    AND polla_schedule_id = v_edition.polla_schedule_id
    AND date = p_date
    AND deleted_at IS NULL;

  v_results := COALESCE(v_results, '{}');

  WITH drawn AS (
    -- Se cuentan repetidos: si el 32 sale dos veces entre los 20 números,
    -- llena dos casilleros con 32.
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

    -- El pozo sorpresa se suma al pozo de la edición.
    v_prize := ROUND((v_edition.pool_amount + v_edition.surprise_pool_amount) / v_winner_count, 2);
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

DROP FUNCTION IF EXISTS polla_process_results_and_accounts(UUID, UUID, DATE);

CREATE OR REPLACE FUNCTION polla_process_results_and_accounts(
  p_organization_id UUID,
  p_schedule_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
SET statement_timeout = '300000'
AS $$
DECLARE
  v_edition RECORD;
  v_processed JSONB;
  v_results JSONB[] := '{}';
  v_dates DATE[] := ARRAY[p_date];
  v_date DATE;
  v_accounts JSONB[];
  v_accounts_updated INTEGER := 0;
BEGIN
  -- Se recorren las ediciones del turno que cubren el día, no los resultados:
  -- si se borró un resultado mal cargado, reprocesar igual limpia sus aciertos.
  -- Con ediciones solapadas, cada una se procesa por separado.
  FOR v_edition IN
    SELECT polla_edition_id
    FROM polla_editions
    WHERE polla_organization_id = p_organization_id
      AND polla_schedule_id = p_schedule_id
      AND p_date BETWEEN start_date AND end_date
      AND deleted_at IS NULL
    ORDER BY start_date, created_at
  LOOP
    v_processed := polla_process_edition_hits(v_edition.polla_edition_id, p_date);
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

REVOKE ALL ON FUNCTION polla_process_edition_hits(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_process_edition_hits(UUID, DATE) TO service_role;
REVOKE ALL ON FUNCTION polla_process_results_and_accounts(UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_process_results_and_accounts(UUID, UUID, DATE) TO service_role;

-- ROLLBACK:
-- Volver a crear el constraint falla si ya hay ediciones solapadas: antes hay
-- que borrar o mover una de cada par.
--
-- ALTER TABLE polla_editions ADD CONSTRAINT no_overlapping_polla_editions
--   EXCLUDE USING gist (
--     polla_organization_id WITH =,
--     polla_lottery_id WITH =,
--     polla_schedule_id WITH =,
--     daterange(start_date, end_date, '[]') WITH &&
--   ) WHERE (deleted_at IS NULL);
-- DROP FUNCTION IF EXISTS polla_process_edition_hits(UUID, DATE);
-- DROP FUNCTION IF EXISTS polla_process_results_and_accounts(UUID, UUID, DATE);
-- Después, volver a crear las dos funciones con las definiciones anteriores:
--   polla_process_edition_hits(UUID, UUID, UUID, DATE) de
--     20261021233444_polla_cutoffs_editions_repeat.sql
--   polla_process_results_and_accounts(UUID, UUID, DATE) de
--     20261005120000_polla_repeated_numbers_hit_dates.sql
