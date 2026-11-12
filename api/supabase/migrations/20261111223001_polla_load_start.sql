-- R29: inicio de carga. Hasta ahora una edición se podía cargar desde que se
-- creaba; ahora tiene "Inicio de carga" (fecha y hora, Argentina) además del
-- "Cierre de carga", para crearla el jueves y abrirla el sábado.
--
-- - `load_start_date` + `load_start_time`, con el mismo patrón que el cierre.
--   Las ediciones existentes toman su fecha de creación (si se crearon después
--   de su propio cierre, un minuto antes del cierre), así no cambia nada.
-- - El inicio tiene que ser anterior al cierre (`POLLA_LOAD_START_AFTER_LIMIT`).
-- - Nadie carga ni repite antes del inicio (`polla_can_load`). Cargar jugada
--   solo ofrece ediciones con la carga abierta (`polla_loadable_editions` ya
--   usa `polla_can_load`).
-- - `polla_create_edition` y `polla_update_edition` reciben los dos campos;
--   sin inicio, el alta toma la fecha y hora actuales.

-- -------------------------------------------------------------- columnas

ALTER TABLE polla_editions
  ADD COLUMN IF NOT EXISTS load_start_date DATE,
  ADD COLUMN IF NOT EXISTS load_start_time TIME;

UPDATE polla_editions e
SET load_start_date = s.ts::DATE,
    load_start_time = date_trunc('minute', s.ts)::TIME
FROM (
  SELECT
    polla_edition_id,
    LEAST(
      created_at AT TIME ZONE 'America/Argentina/Buenos_Aires',
      (load_limit_date + load_limit_time) - INTERVAL '1 minute'
    ) AS ts
  FROM polla_editions
) s
WHERE s.polla_edition_id = e.polla_edition_id;

ALTER TABLE polla_editions
  ALTER COLUMN load_start_date SET DEFAULT (timezone('America/Argentina/Buenos_Aires', now()))::DATE,
  ALTER COLUMN load_start_time SET DEFAULT date_trunc('minute', timezone('America/Argentina/Buenos_Aires', now()))::TIME,
  ALTER COLUMN load_start_date SET NOT NULL,
  ALTER COLUMN load_start_time SET NOT NULL;

COMMENT ON COLUMN polla_editions.load_start_date IS
  'Inicio de carga (fecha, Argentina): antes nadie carga ni repite boletas (R29).';
COMMENT ON COLUMN polla_editions.load_start_time IS
  'Inicio de carga (hora, Argentina).';

-- ----------------------------------------------- inicio antes del cierre

CREATE OR REPLACE FUNCTION validate_polla_edition_load_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_draw_time TIME;
BEGIN
  SELECT time INTO v_draw_time
  FROM polla_schedules
  WHERE polla_schedule_id = NEW.polla_schedule_id;

  IF (NEW.load_limit_date + NEW.load_limit_time) >= (NEW.start_date + COALESCE(v_draw_time, '00:00'::TIME)) THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_AFTER_FIRST_DRAW';
  END IF;

  IF (NEW.load_start_date + NEW.load_start_time) >= (NEW.load_limit_date + NEW.load_limit_time) THEN
    RAISE EXCEPTION 'POLLA_LOAD_START_AFTER_LIMIT';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_polla_edition_load_limit ON polla_editions;
CREATE TRIGGER trg_validate_polla_edition_load_limit
  BEFORE INSERT OR UPDATE OF load_start_date, load_start_time, load_limit_date, load_limit_time,
    start_date, polla_schedule_id
  ON polla_editions
  FOR EACH ROW EXECUTE FUNCTION validate_polla_edition_load_limit();

-- ------------------------------------------------------- carga abierta

-- Desde cuándo se carga (hora de Argentina).
CREATE OR REPLACE FUNCTION polla_load_start(p_edition polla_editions)
RETURNS TIMESTAMP
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_edition.load_start_date + p_edition.load_start_time;
$$;

REVOKE ALL ON FUNCTION polla_load_start(polla_editions) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_load_start(polla_editions) TO service_role;

CREATE OR REPLACE FUNCTION polla_can_load(
  p_edition polla_editions,
  p_role polla_user_type_enum
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMP;
BEGIN
  IF p_edition.status <> 'ACTIVE' OR p_edition.deleted_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- R29: antes del inicio de carga, nadie.
  IF polla_now() < polla_load_start(p_edition) THEN
    RETURN FALSE;
  END IF;

  v_cutoff := polla_load_cutoff(p_edition, p_role);

  IF v_cutoff IS NULL THEN
    RETURN polla_today() <= p_edition.end_date;
  END IF;

  RETURN polla_now() <= v_cutoff;
END;
$$;

-- Corte, inicio y carga abierta de varias ediciones (acciones de cada jugada,
-- y el aviso de "todavía no abrió" de la API).
DROP FUNCTION IF EXISTS polla_editions_load_state(UUID[], polla_user_type_enum);

CREATE FUNCTION polla_editions_load_state(
  p_edition_ids UUID[],
  p_role polla_user_type_enum
)
RETURNS TABLE (
  polla_edition_id UUID,
  load_start TIMESTAMP,
  load_cutoff TIMESTAMP,
  load_started BOOLEAN,
  can_load BOOLEAN
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    e.polla_edition_id,
    polla_load_start(e),
    polla_load_cutoff(e, p_role),
    polla_now() >= polla_load_start(e),
    polla_can_load(e, p_role)
  FROM polla_editions e
  WHERE e.polla_edition_id = ANY (p_edition_ids);
$$;

REVOKE ALL ON FUNCTION polla_editions_load_state(UUID[], polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_editions_load_state(UUID[], polla_user_type_enum) TO service_role;

-- ----------------------------------------------------- alta y cambios

CREATE OR REPLACE FUNCTION polla_create_edition(
  p_organization_id UUID,
  p_payload JSONB,
  p_draws JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_draws JSONB;
  v_edition polla_editions;
BEGIN
  v_draws := polla_parse_edition_draws(p_organization_id, p_draws);

  -- El trigger del cierre de carga lo valida contra el sorteo principal (el
  -- más temprano) y contra el inicio de carga; el de la edición agrega ese
  -- sorteo.
  INSERT INTO polla_editions (
    polla_organization_id,
    polla_lottery_id,
    polla_schedule_id,
    name,
    start_date,
    end_date,
    load_start_date,
    load_start_time,
    load_limit_date,
    load_limit_time,
    pool_amount,
    surprise_pool_amount,
    ticket_price,
    min_winning_hits
  ) VALUES (
    p_organization_id,
    (v_draws->0->>'polla_lottery_id')::UUID,
    (v_draws->0->>'polla_schedule_id')::UUID,
    NULLIF(p_payload->>'name', ''),
    (p_payload->>'start_date')::DATE,
    (p_payload->>'end_date')::DATE,
    -- R29: sin inicio de carga, ahora.
    COALESCE((p_payload->>'load_start_date')::DATE, polla_today()),
    COALESCE((p_payload->>'load_start_time')::TIME, date_trunc('minute', polla_now())::TIME),
    (p_payload->>'load_limit_date')::DATE,
    (p_payload->>'load_limit_time')::TIME,
    (p_payload->>'pool_amount')::NUMERIC,
    COALESCE((p_payload->>'surprise_pool_amount')::NUMERIC, 0),
    (p_payload->>'ticket_price')::NUMERIC,
    COALESCE((p_payload->>'min_winning_hits')::SMALLINT, 10)
  )
  RETURNING * INTO v_edition;

  INSERT INTO polla_edition_draws (polla_edition_id, polla_lottery_id, polla_schedule_id)
  SELECT v_edition.polla_edition_id, (d->>'polla_lottery_id')::UUID, (d->>'polla_schedule_id')::UUID
  FROM jsonb_array_elements(v_draws) d
  ON CONFLICT DO NOTHING;

  RETURN polla_edition_with_draws(v_edition);
END;
$$;

-- Igual que en 20261105090000, más el inicio de carga (R29).
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

  -- Con ganador, el premio ya se repartió: solo se renombra.
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
    OR v_new.min_winning_hits <> v_old.min_winning_hits
  ) THEN
    RAISE EXCEPTION 'POLLA_EDITION_HAS_WINNERS_LOCKED';
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
    IF v_draws_changed
       OR v_new.start_date <> v_old.start_date
       OR v_new.min_winning_hits <> v_old.min_winning_hits THEN
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

  RETURN polla_edition_with_draws(v_new);
END;
$$;

-- ROLLBACK:
-- 1. Volver a crear `validate_polla_edition_load_limit` y su trigger como en
--    20261021233444 (sin el control del inicio), `polla_can_load` como en
--    20261021233444, `polla_editions_load_state` (sin `load_start` ni
--    `load_started`) como en 20261021233444, y `polla_create_edition` y
--    `polla_update_edition` como en 20261105090000.
-- 2. DROP FUNCTION IF EXISTS polla_load_start(polla_editions);
-- 3. ALTER TABLE polla_editions DROP COLUMN load_start_date, DROP COLUMN load_start_time;
