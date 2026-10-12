-- Polla: hora de cierre de carga por edición.
--
-- Hasta ahora la carga cerraba al terminar el día `load_limit_date`. Ahora cada
-- edición define también la hora (`load_limit_time`, hora de Argentina): pasado
-- ese momento, pasadores y jugadores ya no cargan, editan ni borran jugadas de
-- esa edición. Los admin siguen pudiendo con `p_force`.
--
-- Las ediciones existentes quedan con 23:59:59, que es el cierre que tenían.
--
-- Además, el alta deja de comparar contra `p_date`: para un pasador o un
-- jugador la API ya no lo manda, y el cierre se mide contra el momento real.

ALTER TABLE polla_editions
  ADD COLUMN load_limit_time TIME NOT NULL DEFAULT '23:59:59';

-- ============================================================
-- 1. ¿Cerró la carga? Fecha y hora de Argentina
-- ============================================================

DROP FUNCTION IF EXISTS polla_load_closed(DATE, TIME);

CREATE FUNCTION polla_load_closed(p_date DATE, p_time TIME)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') > (p_date + p_time);
$$;

REVOKE ALL ON FUNCTION polla_load_closed(DATE, TIME) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_load_closed(DATE, TIME) TO service_role;

-- ============================================================
-- 2. Alta de una jugada: sin force, solo hasta la fecha y hora de cierre
-- ============================================================

DROP FUNCTION IF EXISTS polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN);

CREATE FUNCTION polla_create_bet(
  p_edition_id UUID,
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_numbers TEXT[],
  p_date DATE DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_date DATE := COALESCE(p_date, polla_today());
  v_edition polla_editions;
  v_target polla_users;
  v_cashier polla_users;
  v_ticket_number TEXT;
  v_bet polla_bets;
  v_attempt INTEGER := 0;
BEGIN
  IF array_length(p_numbers, 1) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_MUST_BE_TEN';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF v_edition.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_ACTIVE';
  END IF;

  IF NOT p_force AND polla_load_closed(v_edition.load_limit_date, v_edition.load_limit_time) THEN
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
        created_by
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
        v_edition.ticket_price,
        p_numbers,
        p_actor_user_id
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
      collected_amount = collected_amount + v_edition.ticket_price,
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

REVOKE ALL ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN) TO service_role;

-- ============================================================
-- 3. Edición de números: mismo cierre por fecha y hora
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

  IF NOT p_force AND polla_load_closed(v_edition.load_limit_date, v_edition.load_limit_time) THEN
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
-- 4. Baja de una jugada: sin force, del día y con la carga abierta
-- ============================================================

DROP FUNCTION IF EXISTS polla_delete_bet(UUID, UUID, BOOLEAN);

CREATE FUNCTION polla_delete_bet(
  p_bet_id UUID,
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

  IF NOT p_force THEN
    IF v_bet.load_date <> polla_today() THEN
      RAISE EXCEPTION 'POLLA_BET_DELETE_ONLY_SAME_DAY';
    END IF;

    IF polla_load_closed(v_edition.load_limit_date, v_edition.load_limit_time) THEN
      RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
    END IF;
  END IF;

  UPDATE polla_bets
  SET deleted_at = NOW(),
      deleted_by = p_actor_id
  WHERE polla_bet_id = p_bet_id;

  UPDATE polla_editions
  SET bets_count = GREATEST(bets_count - 1, 0),
      collected_amount = GREATEST(collected_amount - v_bet.amount, 0),
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id;

  PERFORM polla_refresh_current_account_row(
    v_bet.cashier_polla_user_id,
    v_bet.load_date,
    v_bet.polla_organization_id
  );

  RETURN jsonb_build_object('success', true, 'polla_bet_id', p_bet_id);
END;
$$;

REVOKE ALL ON FUNCTION polla_delete_bet(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_delete_bet(UUID, UUID, BOOLEAN) TO service_role;
