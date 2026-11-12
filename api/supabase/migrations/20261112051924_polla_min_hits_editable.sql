-- R26 (ajuste): el mínimo de aciertos de una edición especial se puede
-- cambiar con la edición empezada, por si se cargó mal al crearla.
--
-- - Se cambia aunque haya resultados cargados o ganadores, siempre que no se
--   haya marcado ningún premio como pagado (`POLLA_EDITION_PRIZE_PAID_LOCKED`).
-- - El mínimo solo decide al final: si nadie completó 10, ganan los de más
--   aciertos desde el mínimo. Por eso:
--   - si la edición sigue en juego, solo se guarda el número;
--   - si ya terminó por la escalera (o quedó desierta), se vuelve a procesar el
--     último día con el mínimo nuevo: se recalculan ganadores, premios y estado;
--   - si terminó porque alguien completó 10, el mínimo no cambia nada.
-- - Con ganadores, el resto sigue fijo: solo el nombre y el mínimo.
--
-- `polla_update_edition` es la de 20261111223001 con esos cambios.

CREATE OR REPLACE FUNCTION polla_update_edition(p_edition_id UUID, p_changes JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old polla_editions;
  v_new polla_editions;
  v_last_draw DATE;
  v_draws JSONB;
  v_old_draws TEXT[];
  v_new_draws TEXT[];
  v_draws_changed BOOLEAN := FALSE;
  v_min_changed BOOLEAN;
BEGIN
  SELECT * INTO v_old
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  v_new := v_old;
  IF p_changes ? 'name' THEN v_new.name := p_changes->>'name'; END IF;
  IF p_changes ? 'start_date' THEN v_new.start_date := (p_changes->>'start_date')::DATE; END IF;
  IF p_changes ? 'end_date' THEN v_new.end_date := (p_changes->>'end_date')::DATE; END IF;
  IF p_changes ? 'load_start_date' THEN v_new.load_start_date := (p_changes->>'load_start_date')::DATE; END IF;
  IF p_changes ? 'load_start_time' THEN v_new.load_start_time := (p_changes->>'load_start_time')::TIME; END IF;
  IF p_changes ? 'load_limit_date' THEN v_new.load_limit_date := (p_changes->>'load_limit_date')::DATE; END IF;
  IF p_changes ? 'load_limit_time' THEN v_new.load_limit_time := (p_changes->>'load_limit_time')::TIME; END IF;
  IF p_changes ? 'pool_amount' THEN v_new.pool_amount := (p_changes->>'pool_amount')::NUMERIC; END IF;
  IF p_changes ? 'surprise_pool_amount' THEN v_new.surprise_pool_amount := (p_changes->>'surprise_pool_amount')::NUMERIC; END IF;
  -- El precio vale para las jugadas nuevas: cada jugada guarda el suyo.
  IF p_changes ? 'ticket_price' THEN v_new.ticket_price := (p_changes->>'ticket_price')::NUMERIC; END IF;
  IF p_changes ? 'min_winning_hits' THEN v_new.min_winning_hits := (p_changes->>'min_winning_hits')::SMALLINT; END IF;

  v_min_changed := v_new.min_winning_hits <> v_old.min_winning_hits;

  SELECT array_agg(polla_lottery_id::TEXT || '/' || polla_schedule_id::TEXT ORDER BY 1)
  INTO v_old_draws
  FROM polla_edition_draws
  WHERE polla_edition_id = p_edition_id;

  v_draws := p_changes->'draws';
  -- La API anterior manda quiniela y turno sueltos: valen como el único
  -- sorteo de una edición que tiene uno solo.
  IF v_draws IS NULL
     AND (p_changes ? 'polla_lottery_id' OR p_changes ? 'polla_schedule_id')
     AND cardinality(v_old_draws) = 1 THEN
    v_draws := jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', COALESCE(p_changes->>'polla_lottery_id', v_old.polla_lottery_id::TEXT),
      'polla_schedule_id', COALESCE(p_changes->>'polla_schedule_id', v_old.polla_schedule_id::TEXT)
    ));
  END IF;

  IF v_draws IS NOT NULL THEN
    v_draws := polla_parse_edition_draws(v_old.polla_organization_id, v_draws);

    SELECT array_agg((d->>'polla_lottery_id') || '/' || (d->>'polla_schedule_id') ORDER BY 1)
    INTO v_new_draws
    FROM jsonb_array_elements(v_draws) d;

    v_draws_changed := v_new_draws IS DISTINCT FROM v_old_draws;
    v_new.polla_lottery_id := (v_draws->0->>'polla_lottery_id')::UUID;
    v_new.polla_schedule_id := (v_draws->0->>'polla_schedule_id')::UUID;
  END IF;

  -- Con ganador, el premio ya se repartió: solo el nombre y el mínimo de
  -- aciertos (que recalcula los ganadores).
  IF v_old.winner_date IS NOT NULL AND (
       v_draws_changed
    OR v_new.start_date <> v_old.start_date
    OR v_new.end_date <> v_old.end_date
    OR v_new.load_start_date <> v_old.load_start_date
    OR v_new.load_start_time <> v_old.load_start_time
    OR v_new.load_limit_date <> v_old.load_limit_date
    OR v_new.load_limit_time <> v_old.load_limit_time
    OR v_new.pool_amount <> v_old.pool_amount
    OR v_new.surprise_pool_amount <> v_old.surprise_pool_amount
    OR v_new.ticket_price <> v_old.ticket_price
  ) THEN
    RAISE EXCEPTION 'POLLA_EDITION_HAS_WINNERS_LOCKED';
  END IF;

  -- El mínimo no se toca si ya se pagó algún premio de la edición.
  IF v_min_changed AND EXISTS (
    SELECT 1
    FROM polla_bets b
    WHERE b.polla_edition_id = p_edition_id
      AND b.deleted_at IS NULL
      AND b.prize_paid_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'POLLA_EDITION_PRIZE_PAID_LOCKED';
  END IF;

  -- Último sorteo con resultados dentro de la edición, de cualquiera de sus sorteos.
  SELECT MAX(r.date) INTO v_last_draw
  FROM polla_edition_draws d
  JOIN polla_results r
    ON r.polla_organization_id = v_old.polla_organization_id
   AND r.polla_lottery_id = d.polla_lottery_id
   AND r.polla_schedule_id = d.polla_schedule_id
  WHERE d.polla_edition_id = p_edition_id
    AND r.date BETWEEN v_old.start_date AND v_old.end_date
    AND r.deleted_at IS NULL;

  IF v_last_draw IS NOT NULL THEN
    -- Con sorteos cargados no se mueven los sorteos ni el inicio; el mínimo sí.
    IF v_draws_changed OR v_new.start_date <> v_old.start_date THEN
      RAISE EXCEPTION 'POLLA_EDITION_DRAWS_LOCKED';
    END IF;

    IF v_new.end_date < v_last_draw THEN
      RAISE EXCEPTION 'POLLA_EDITION_END_BEFORE_DRAW';
    END IF;
  END IF;

  -- Extender una edición que terminó sin ganador la vuelve a poner en juego,
  -- salvo que ya se hayan repetido tickets sin cargo desde ella.
  IF v_new.end_date > v_old.end_date AND v_old.status = 'FINISHED' AND v_old.winner_date IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM polla_bets r
      JOIN polla_bets s ON s.polla_bet_id = r.repeated_from_bet_id
      WHERE s.polla_edition_id = p_edition_id
        AND r.is_free
        AND r.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'POLLA_EDITION_EXTEND_AFTER_FREE_REPEAT';
    END IF;

    v_new.status := 'ACTIVE';
  END IF;

  UPDATE polla_editions
  SET name = v_new.name,
      polla_lottery_id = v_new.polla_lottery_id,
      polla_schedule_id = v_new.polla_schedule_id,
      start_date = v_new.start_date,
      end_date = v_new.end_date,
      load_start_date = v_new.load_start_date,
      load_start_time = v_new.load_start_time,
      load_limit_date = v_new.load_limit_date,
      load_limit_time = v_new.load_limit_time,
      pool_amount = v_new.pool_amount,
      surprise_pool_amount = v_new.surprise_pool_amount,
      ticket_price = v_new.ticket_price,
      min_winning_hits = v_new.min_winning_hits,
      status = v_new.status,
      edited_at = NOW()
  WHERE polla_edition_id = p_edition_id
  RETURNING * INTO v_new;

  IF v_draws_changed THEN
    DELETE FROM polla_edition_draws WHERE polla_edition_id = p_edition_id;
    INSERT INTO polla_edition_draws (polla_edition_id, polla_lottery_id, polla_schedule_id)
    SELECT p_edition_id, (d->>'polla_lottery_id')::UUID, (d->>'polla_schedule_id')::UUID
    FROM jsonb_array_elements(v_draws) d;
  END IF;

  -- Terminó por la escalera o desierta (no por un 10 antes del final): el
  -- último día se vuelve a procesar con el mínimo nuevo. Recalcula ganadores,
  -- premios y estado (y deja la edición como estaba si no cambia nada).
  IF v_min_changed
     AND v_old.status = 'FINISHED'
     AND (v_old.winner_date IS NULL OR v_old.winner_date >= v_old.end_date) THEN
    PERFORM polla_process_edition_hits(p_edition_id, v_new.end_date);

    SELECT * INTO v_new
    FROM polla_editions
    WHERE polla_edition_id = p_edition_id;
  END IF;

  RETURN polla_edition_with_draws(v_new);
END;
$$;

-- ROLLBACK:
-- Volver a crear `polla_update_edition` con la definición de
-- 20261111223001_polla_load_start.sql (el mínimo queda fijo con resultados o
-- ganadores). Los ganadores recalculados quedan como están.
