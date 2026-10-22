-- Polla: corte de carga por rol, edición de pollas, pozo sorpresa y repetir
-- tickets (con o sin cargo).
--
-- * Corte de carga (polla_load_cutoff, única fuente de la regla):
--   - Pasador y jugador: fecha y hora de cierre de la edición.
--   - Admin: el día de cierre a la hora del turno activo más tarde de la
--     organización (nunca antes que el cierre del pasador) y nunca después del
--     primer sorteo de la edición. Carga siempre con la fecha de hoy.
--   - Superadmin, capitalista y dueño: sin corte, hasta el último día de juego
--     con la edición activa. Eligen el día de carga.
--   Editar y borrar siguen el mismo corte: el admin solo en su grupo, el
--   pasador solo borra lo suyo y lo de sus jugadores, el superadmin+ siempre.
-- * El cierre de carga puede ser el mismo día del primer sorteo, siempre antes
--   de la hora del turno (polla de un día). Reemplaza al CHECK
--   load_limit_date < start_date.
-- * polla_create_bet saca el rol del actor (p_force queda por compatibilidad y
--   no se usa) y valida a nombre de quién se carga: el admin en su grupo, el
--   pasador a él o a sus jugadores, el jugador a él.
-- * Pozo sorpresa: se suma al pozo para el premio; se corrige mientras no haya
--   ganador.
-- * polla_update_edition: cambios de una edición con sus reglas (precio solo
--   para jugadas nuevas, extender sin ganador, bloqueos por sorteos jugados).
-- * polla_repeat_bets: repite tickets a nombre de su dueño original, pagos o
--   sin cargo (estos, de ediciones finalizadas y solo admin+). Sin cargo = $0
--   en el pase, la comisión y lo recaudado.

-- ============================================================
-- 1. Columnas
-- ============================================================

ALTER TABLE polla_editions
  ADD COLUMN IF NOT EXISTS surprise_pool_amount NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (surprise_pool_amount >= 0);

COMMENT ON COLUMN polla_editions.surprise_pool_amount IS
  'Pozo sorpresa: se suma al pozo para repartir entre los ganadores.';

ALTER TABLE polla_bets
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS repeated_from_bet_id UUID REFERENCES polla_bets(polla_bet_id);

COMMENT ON COLUMN polla_bets.is_free IS
  'Repetida sin cargo: amount = 0, no suma al pase ni a lo recaudado.';
COMMENT ON COLUMN polla_bets.repeated_from_bet_id IS
  'Ticket del que se repitió esta jugada.';

CREATE INDEX IF NOT EXISTS idx_polla_bets_repeated_from
  ON polla_bets (repeated_from_bet_id)
  WHERE repeated_from_bet_id IS NOT NULL;

-- Filtro de aciertos del listado.
CREATE INDEX IF NOT EXISTS idx_polla_bets_edition_hits
  ON polla_bets (polla_edition_id, hits)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 2. Cierre de carga antes del primer sorteo (puede ser el mismo día)
-- ============================================================

DO $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'polla_editions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%load_limit_date < start_date%';

  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE polla_editions DROP CONSTRAINT %I', v_name);
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_polla_edition_load_limit ON polla_editions;
DROP FUNCTION IF EXISTS validate_polla_edition_load_limit();

CREATE FUNCTION validate_polla_edition_load_limit()
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_polla_edition_load_limit
  BEFORE INSERT OR UPDATE OF load_limit_date, load_limit_time, start_date, polla_schedule_id
  ON polla_editions
  FOR EACH ROW EXECUTE FUNCTION validate_polla_edition_load_limit();

-- ============================================================
-- 3. Corte de carga por rol
-- ============================================================

DROP FUNCTION IF EXISTS polla_now();

CREATE FUNCTION polla_now()
RETURNS TIMESTAMP
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires';
$$;

REVOKE ALL ON FUNCTION polla_now() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_now() TO service_role;

DROP FUNCTION IF EXISTS polla_load_cutoff(polla_editions, polla_user_type_enum);

-- Momento (hora de Argentina) hasta el que el rol carga en la edición. NULL:
-- sin corte, hasta el último día de juego (superadmin y superiores).
CREATE FUNCTION polla_load_cutoff(
  p_edition polla_editions,
  p_role polla_user_type_enum
)
RETURNS TIMESTAMP
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_latest_schedule TIME;
  v_draw_time TIME;
BEGIN
  IF p_role IN ('OWNER', 'CAPITALIST', 'SUPERADMIN') THEN
    RETURN NULL;
  END IF;

  IF p_role <> 'ADMIN' THEN
    RETURN p_edition.load_limit_date + p_edition.load_limit_time;
  END IF;

  SELECT MAX(time) INTO v_latest_schedule
  FROM polla_schedules
  WHERE polla_organization_id = p_edition.polla_organization_id
    AND active
    AND deleted_at IS NULL;

  SELECT time INTO v_draw_time
  FROM polla_schedules
  WHERE polla_schedule_id = p_edition.polla_schedule_id;

  RETURN LEAST(
    p_edition.load_limit_date
      + GREATEST(p_edition.load_limit_time, COALESCE(v_latest_schedule, p_edition.load_limit_time)),
    p_edition.start_date + COALESCE(v_draw_time, '23:59:59'::TIME)
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_load_cutoff(polla_editions, polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_load_cutoff(polla_editions, polla_user_type_enum) TO service_role;

DROP FUNCTION IF EXISTS polla_can_load(polla_editions, polla_user_type_enum);

CREATE FUNCTION polla_can_load(
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

  v_cutoff := polla_load_cutoff(p_edition, p_role);

  IF v_cutoff IS NULL THEN
    RETURN polla_today() <= p_edition.end_date;
  END IF;

  RETURN polla_now() <= v_cutoff;
END;
$$;

REVOKE ALL ON FUNCTION polla_can_load(polla_editions, polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_can_load(polla_editions, polla_user_type_enum) TO service_role;

-- Ediciones donde el rol carga ahora, con su corte (Cargar jugada).
DROP FUNCTION IF EXISTS polla_loadable_editions(UUID, polla_user_type_enum);

CREATE FUNCTION polla_loadable_editions(
  p_organization_id UUID,
  p_role polla_user_type_enum
)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_jsonb(e.*) || jsonb_build_object(
    'my_load_cutoff', polla_load_cutoff(e, p_role)
  )
  FROM polla_editions e
  WHERE e.polla_organization_id = p_organization_id
    AND e.deleted_at IS NULL
    AND e.status = 'ACTIVE'
    AND polla_can_load(e, p_role)
  ORDER BY e.start_date DESC;
$$;

REVOKE ALL ON FUNCTION polla_loadable_editions(UUID, polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_loadable_editions(UUID, polla_user_type_enum) TO service_role;

-- Corte y carga abierta de varias ediciones (acciones de cada jugada listada).
DROP FUNCTION IF EXISTS polla_editions_load_state(UUID[], polla_user_type_enum);

CREATE FUNCTION polla_editions_load_state(
  p_edition_ids UUID[],
  p_role polla_user_type_enum
)
RETURNS TABLE (
  polla_edition_id UUID,
  load_cutoff TIMESTAMP,
  can_load BOOLEAN
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT e.polla_edition_id, polla_load_cutoff(e, p_role), polla_can_load(e, p_role)
  FROM polla_editions e
  WHERE e.polla_edition_id = ANY (p_edition_ids);
$$;

REVOKE ALL ON FUNCTION polla_editions_load_state(UUID[], polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_editions_load_state(UUID[], polla_user_type_enum) TO service_role;

-- ============================================================
-- 4. Alta de una jugada: corte y alcance según el rol del actor
-- ============================================================

DROP FUNCTION IF EXISTS polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN);
DROP FUNCTION IF EXISTS polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID);

CREATE FUNCTION polla_create_bet(
  p_edition_id UUID,
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_numbers TEXT[],
  p_date DATE DEFAULT NULL,
  -- Sin uso: el corte sale del rol del actor. Queda para la API del deploy.
  p_force BOOLEAN DEFAULT FALSE,
  p_free BOOLEAN DEFAULT FALSE,
  p_repeated_from UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor polla_users;
  v_is_super BOOLEAN;
  v_date DATE;
  v_edition polla_editions;
  v_target polla_users;
  v_cashier polla_users;
  v_amount NUMERIC(12,2);
  v_ticket_number TEXT;
  v_bet polla_bets;
  v_attempt INTEGER := 0;
BEGIN
  IF array_length(p_numbers, 1) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_MUST_BE_TEN';
  END IF;

  SELECT * INTO v_actor
  FROM polla_users
  WHERE polla_user_id = p_actor_user_id
    AND deleted_at IS NULL
    AND disabled = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  v_is_super := v_actor.user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN');
  -- Solo superadmin+ elige el día de carga.
  v_date := CASE WHEN v_is_super THEN COALESCE(p_date, polla_today()) ELSE polla_today() END;

  IF p_free AND v_actor.user_type NOT IN ('OWNER', 'CAPITALIST', 'SUPERADMIN', 'ADMIN') THEN
    RAISE EXCEPTION 'POLLA_FREE_BET_FORBIDDEN';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF v_edition.polla_organization_id <> v_actor.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_USER_OTHER_ORGANIZATION';
  END IF;

  IF v_edition.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_ACTIVE';
  END IF;

  IF NOT polla_can_load(v_edition, v_actor.user_type) THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  SELECT * INTO v_target
  FROM polla_users
  WHERE polla_user_id = p_target_user_id
    AND deleted_at IS NULL
    AND disabled = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  IF v_target.polla_organization_id <> v_edition.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_USER_OTHER_ORGANIZATION';
  END IF;

  IF v_target.user_type NOT IN ('PLAYER', 'CASHIER') THEN
    RAISE EXCEPTION 'POLLA_USER_CANNOT_BET';
  END IF;

  -- A nombre de quién carga cada rol.
  IF v_actor.user_type = 'ADMIN' THEN
    IF v_actor.polla_group_id IS NULL
       OR v_target.polla_group_id IS DISTINCT FROM v_actor.polla_group_id THEN
      RAISE EXCEPTION 'POLLA_USER_OTHER_GROUP';
    END IF;
  ELSIF v_actor.user_type = 'CASHIER' THEN
    IF v_target.polla_user_id <> v_actor.polla_user_id
       AND v_target.parent_polla_user_id IS DISTINCT FROM v_actor.polla_user_id THEN
      RAISE EXCEPTION 'POLLA_BET_TARGET_FORBIDDEN';
    END IF;
  ELSIF v_actor.user_type = 'PLAYER' THEN
    IF v_target.polla_user_id <> v_actor.polla_user_id THEN
      RAISE EXCEPTION 'POLLA_BET_TARGET_FORBIDDEN';
    END IF;
  END IF;

  IF v_target.user_type = 'PLAYER' THEN
    SELECT * INTO v_cashier
    FROM polla_users
    WHERE polla_user_id = v_target.parent_polla_user_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POLLA_PARENT_NOT_FOUND';
    END IF;
  ELSE
    v_cashier := v_target;
  END IF;

  v_amount := CASE WHEN p_free THEN 0 ELSE v_edition.ticket_price END;

  LOOP
    v_attempt := v_attempt + 1;
    v_ticket_number := to_char(
                         clock_timestamp() AT TIME ZONE 'America/Argentina/Buenos_Aires',
                         'YYYYMMDDHH24MISSMS'
                       )
                       || '-'
                       || COALESCE(v_cashier.number, (floor(random() * 1000))::INTEGER);

    BEGIN
      INSERT INTO polla_bets (
        ticket_number,
        polla_edition_id,
        polla_user_id,
        cashier_polla_user_id,
        polla_organization_id,
        polla_group_id,
        user_name,
        cashier_name,
        cashier_number,
        load_date,
        amount,
        numbers,
        created_by,
        is_free,
        repeated_from_bet_id
      ) VALUES (
        v_ticket_number,
        v_edition.polla_edition_id,
        v_target.polla_user_id,
        v_cashier.polla_user_id,
        v_edition.polla_organization_id,
        v_cashier.polla_group_id,
        v_target.name,
        v_cashier.name,
        v_cashier.number,
        v_date,
        v_amount,
        p_numbers,
        p_actor_user_id,
        COALESCE(p_free, FALSE),
        p_repeated_from
      )
      RETURNING * INTO v_bet;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN
        RAISE EXCEPTION 'POLLA_TICKET_NUMBER_COLLISION';
      END IF;
      PERFORM pg_sleep(0.005);
    END;
  END LOOP;

  UPDATE polla_editions
  SET bets_count = bets_count + 1,
      collected_amount = collected_amount + v_amount,
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id;

  PERFORM polla_refresh_current_account_row(
    v_bet.cashier_polla_user_id,
    v_bet.load_date,
    v_bet.polla_organization_id
  );

  RETURN jsonb_build_object('success', true, 'bet', to_jsonb(v_bet));
END;
$$;

REVOKE ALL ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID) TO service_role;

-- ============================================================
-- 5. ¿Puede el actor modificar esta jugada ahora? (editar y borrar)
-- ============================================================

DROP FUNCTION IF EXISTS polla_assert_bet_writable(polla_bets, polla_users, polla_editions, BOOLEAN);

CREATE FUNCTION polla_assert_bet_writable(
  p_bet polla_bets,
  p_actor polla_users,
  p_edition polla_editions,
  p_editing BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMP;
BEGIN
  IF p_bet.polla_organization_id <> p_actor.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_USER_OTHER_ORGANIZATION';
  END IF;

  -- Superadmin+: siempre.
  IF p_actor.user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN') THEN
    RETURN;
  END IF;

  IF p_actor.user_type = 'ADMIN' THEN
    IF p_actor.polla_group_id IS NULL
       OR p_bet.polla_group_id IS DISTINCT FROM p_actor.polla_group_id THEN
      RAISE EXCEPTION 'POLLA_USER_OTHER_GROUP';
    END IF;
  ELSIF p_actor.user_type = 'CASHIER' AND NOT p_editing THEN
    IF p_bet.cashier_polla_user_id <> p_actor.polla_user_id THEN
      RAISE EXCEPTION 'POLLA_BET_TARGET_FORBIDDEN';
    END IF;
  ELSE
    -- El pasador no edita; el jugador no modifica nada.
    RAISE EXCEPTION 'POLLA_BET_WRITE_FORBIDDEN';
  END IF;

  v_cutoff := polla_load_cutoff(p_edition, p_actor.user_type);
  IF v_cutoff IS NOT NULL AND polla_now() > v_cutoff THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION polla_assert_bet_writable(polla_bets, polla_users, polla_editions, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_assert_bet_writable(polla_bets, polla_users, polla_editions, BOOLEAN) TO service_role;

-- ============================================================
-- 6. Edición de números
-- ============================================================

DROP FUNCTION IF EXISTS polla_update_bet_numbers(UUID, TEXT[], UUID, BOOLEAN);

CREATE FUNCTION polla_update_bet_numbers(
  p_bet_id UUID,
  p_numbers TEXT[],
  p_actor_id UUID,
  -- Sin uso: el permiso sale del rol del actor.
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bet polla_bets;
  v_edition polla_editions;
  v_actor polla_users;
BEGIN
  IF array_length(p_numbers, 1) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_MUST_BE_TEN';
  END IF;

  SELECT * INTO v_actor
  FROM polla_users
  WHERE polla_user_id = p_actor_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
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

  PERFORM polla_assert_bet_writable(v_bet, v_actor, v_edition, TRUE);

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
-- 7. Baja de una jugada (igual que en 20261020212216; cambia el permiso)
-- ============================================================

DROP FUNCTION IF EXISTS polla_delete_bet(UUID, UUID, BOOLEAN);

CREATE FUNCTION polla_delete_bet(
  p_bet_id UUID,
  p_actor_id UUID,
  -- Sin uso: el permiso sale del rol del actor.
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bet polla_bets;
  v_edition polla_editions;
  v_actor polla_users;
  v_deducted_on DATE;
BEGIN
  SELECT * INTO v_actor
  FROM polla_users
  WHERE polla_user_id = p_actor_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
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
  WHERE polla_edition_id = v_bet.polla_edition_id
  FOR UPDATE;

  PERFORM polla_assert_bet_writable(v_bet, v_actor, v_edition, FALSE);

  -- La baja se descuenta hoy; si la cuenta del pasador ya se liquidó hoy, al
  -- día siguiente: lo liquidado no cambia. GREATEST ignora el NULL de un
  -- pasador que nunca se liquidó.
  SELECT GREATEST(polla_today(), MAX(ca.date) + 1)
  INTO v_deducted_on
  FROM polla_current_accounts ca
  WHERE ca.polla_user_id = v_bet.cashier_polla_user_id
    AND ca.is_liquidated;

  UPDATE polla_bets
  SET deleted_at = NOW(),
      deleted_by = p_actor_id,
      deducted_on = v_deducted_on
  WHERE polla_bet_id = p_bet_id;

  UPDATE polla_editions
  SET bets_count = GREATEST(bets_count - 1, 0),
      collected_amount = GREATEST(collected_amount - v_bet.amount, 0),
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id;

  PERFORM polla_refresh_current_account_row(
    v_bet.cashier_polla_user_id,
    v_deducted_on,
    v_bet.polla_organization_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'polla_bet_id', p_bet_id,
    'deducted_on', v_deducted_on
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_delete_bet(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_delete_bet(UUID, UUID, BOOLEAN) TO service_role;

-- ============================================================
-- 8. Repetir tickets a nombre de su dueño (pagos o sin cargo)
-- ============================================================

DROP FUNCTION IF EXISTS polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN);

CREATE FUNCTION polla_repeat_bets(
  p_actor_id UUID,
  p_edition_id UUID,
  p_bet_ids UUID[],
  p_free BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor polla_users;
  v_edition polla_editions;
  v_source polla_bets;
  v_source_status polla_edition_status_enum;
  v_source_id UUID;
  v_result JSONB;
  v_created JSONB := '[]'::JSONB;
  v_skipped JSONB := '[]'::JSONB;
  v_reason TEXT;
BEGIN
  SELECT * INTO v_actor
  FROM polla_users
  WHERE polla_user_id = p_actor_id
    AND deleted_at IS NULL
    AND disabled = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  IF p_free AND v_actor.user_type NOT IN ('OWNER', 'CAPITALIST', 'SUPERADMIN', 'ADMIN') THEN
    RAISE EXCEPTION 'POLLA_FREE_BET_FORBIDDEN';
  END IF;

  -- Lo que vale para todo el lote se controla una vez.
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF v_edition.polla_organization_id <> v_actor.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_USER_OTHER_ORGANIZATION';
  END IF;

  IF NOT polla_can_load(v_edition, v_actor.user_type) THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  FOR v_source_id IN SELECT DISTINCT unnest(p_bet_ids)
  LOOP
    v_reason := NULL;

    SELECT * INTO v_source
    FROM polla_bets
    WHERE polla_bet_id = v_source_id
      AND deleted_at IS NULL;

    IF NOT FOUND OR v_source.polla_organization_id <> v_actor.polla_organization_id THEN
      v_reason := 'POLLA_BET_NOT_FOUND';
    ELSIF v_actor.user_type = 'ADMIN'
      AND (v_actor.polla_group_id IS NULL
           OR v_source.polla_group_id IS DISTINCT FROM v_actor.polla_group_id) THEN
      v_reason := 'POLLA_BET_OUT_OF_SCOPE';
    ELSIF v_actor.user_type = 'CASHIER'
      AND v_source.cashier_polla_user_id <> v_actor.polla_user_id THEN
      v_reason := 'POLLA_BET_OUT_OF_SCOPE';
    ELSIF v_actor.user_type = 'PLAYER'
      AND v_source.polla_user_id <> v_actor.polla_user_id THEN
      v_reason := 'POLLA_BET_OUT_OF_SCOPE';
    END IF;

    IF v_reason IS NULL AND p_free THEN
      SELECT status INTO v_source_status
      FROM polla_editions
      WHERE polla_edition_id = v_source.polla_edition_id;

      IF v_source_status IS DISTINCT FROM 'FINISHED' THEN
        v_reason := 'POLLA_SOURCE_EDITION_NOT_FINISHED';
      END IF;
    END IF;

    IF v_reason IS NULL THEN
      BEGIN
        v_result := polla_create_bet(
          p_edition_id,
          p_actor_id,
          v_source.polla_user_id,
          v_source.numbers,
          NULL,
          FALSE,
          p_free,
          v_source.polla_bet_id
        );
        v_created := v_created || jsonb_build_array(v_result->'bet');
      EXCEPTION WHEN OTHERS THEN
        v_reason := SQLERRM;
      END;
    END IF;

    IF v_reason IS NOT NULL THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'polla_bet_id', v_source_id,
        'ticket_number', v_source.ticket_number,
        'user_name', v_source.user_name,
        'reason', v_reason
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN) TO service_role;

-- ============================================================
-- 9. Cambios de una edición
-- ============================================================

DROP FUNCTION IF EXISTS polla_update_edition(UUID, JSONB);

CREATE FUNCTION polla_update_edition(
  p_edition_id UUID,
  p_changes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old polla_editions;
  v_new polla_editions;
  v_last_draw DATE;
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
  IF p_changes ? 'polla_lottery_id' THEN v_new.polla_lottery_id := (p_changes->>'polla_lottery_id')::UUID; END IF;
  IF p_changes ? 'polla_schedule_id' THEN v_new.polla_schedule_id := (p_changes->>'polla_schedule_id')::UUID; END IF;
  IF p_changes ? 'start_date' THEN v_new.start_date := (p_changes->>'start_date')::DATE; END IF;
  IF p_changes ? 'end_date' THEN v_new.end_date := (p_changes->>'end_date')::DATE; END IF;
  IF p_changes ? 'load_limit_date' THEN v_new.load_limit_date := (p_changes->>'load_limit_date')::DATE; END IF;
  IF p_changes ? 'load_limit_time' THEN v_new.load_limit_time := (p_changes->>'load_limit_time')::TIME; END IF;
  IF p_changes ? 'pool_amount' THEN v_new.pool_amount := (p_changes->>'pool_amount')::NUMERIC; END IF;
  IF p_changes ? 'surprise_pool_amount' THEN v_new.surprise_pool_amount := (p_changes->>'surprise_pool_amount')::NUMERIC; END IF;
  -- El precio vale para las jugadas nuevas: cada jugada guarda el suyo.
  IF p_changes ? 'ticket_price' THEN v_new.ticket_price := (p_changes->>'ticket_price')::NUMERIC; END IF;

  -- Con ganador, el premio ya se repartió: solo se renombra.
  IF v_old.winner_date IS NOT NULL AND (
       v_new.polla_lottery_id <> v_old.polla_lottery_id
    OR v_new.polla_schedule_id <> v_old.polla_schedule_id
    OR v_new.start_date <> v_old.start_date
    OR v_new.end_date <> v_old.end_date
    OR v_new.load_limit_date <> v_old.load_limit_date
    OR v_new.load_limit_time <> v_old.load_limit_time
    OR v_new.pool_amount <> v_old.pool_amount
    OR v_new.surprise_pool_amount <> v_old.surprise_pool_amount
    OR v_new.ticket_price <> v_old.ticket_price
  ) THEN
    RAISE EXCEPTION 'POLLA_EDITION_HAS_WINNERS_LOCKED';
  END IF;

  -- Último sorteo con resultados dentro de la edición.
  SELECT MAX(r.date) INTO v_last_draw
  FROM polla_results r
  WHERE r.polla_organization_id = v_old.polla_organization_id
    AND r.polla_lottery_id = v_old.polla_lottery_id
    AND r.polla_schedule_id = v_old.polla_schedule_id
    AND r.date BETWEEN v_old.start_date AND v_old.end_date
    AND r.deleted_at IS NULL;

  IF v_last_draw IS NOT NULL THEN
    IF v_new.polla_lottery_id <> v_old.polla_lottery_id
       OR v_new.polla_schedule_id <> v_old.polla_schedule_id
       OR v_new.start_date <> v_old.start_date THEN
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
      load_limit_date = v_new.load_limit_date,
      load_limit_time = v_new.load_limit_time,
      pool_amount = v_new.pool_amount,
      surprise_pool_amount = v_new.surprise_pool_amount,
      ticket_price = v_new.ticket_price,
      status = v_new.status,
      edited_at = NOW()
  WHERE polla_edition_id = p_edition_id
  RETURNING * INTO v_new;

  RETURN to_jsonb(v_new);
END;
$$;

REVOKE ALL ON FUNCTION polla_update_edition(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_update_edition(UUID, JSONB) TO service_role;

-- ============================================================
-- 10. Aciertos y ganadores: el premio suma el pozo sorpresa
--     Igual que en 20261006140000; cambia el cálculo de v_prize.
-- ============================================================

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

REVOKE ALL ON FUNCTION polla_process_edition_hits(UUID, UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_process_edition_hits(UUID, UUID, UUID, DATE) TO service_role;

-- ============================================================
-- 11. Ventas del día: por grupo y sin los tickets sin cargo
-- ============================================================

DROP FUNCTION IF EXISTS polla_daily_sales(UUID, DATE, UUID);
DROP FUNCTION IF EXISTS polla_daily_sales(UUID, DATE, UUID, UUID);

CREATE FUNCTION polla_daily_sales(
  p_organization_id UUID,
  p_date DATE,
  p_cashier_id UUID DEFAULT NULL,
  p_group_id UUID DEFAULT NULL
)
RETURNS TABLE (
  polla_group_id UUID,
  group_name TEXT,
  bets_count BIGINT,
  amount NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    b.polla_group_id,
    g.name AS group_name,
    COUNT(*) AS bets_count,
    COALESCE(SUM(b.amount), 0) AS amount
  FROM polla_bets b
  LEFT JOIN polla_groups g ON g.polla_group_id = b.polla_group_id
  WHERE b.polla_organization_id = p_organization_id
    AND b.load_date = p_date
    AND b.deleted_at IS NULL
    AND NOT b.is_free
    AND (p_cashier_id IS NULL OR b.cashier_polla_user_id = p_cashier_id)
    AND (p_group_id IS NULL OR b.polla_group_id = p_group_id)
  GROUP BY b.polla_group_id, g.name
  ORDER BY g.name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION polla_daily_sales(UUID, DATE, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_daily_sales(UUID, DATE, UUID, UUID) TO service_role;
