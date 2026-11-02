-- Polla: identificador del ticket y ventas de toda la edición.
--
-- * El identificador ("chicho") ya no es obligatorio en todo lo que carga un
--   pasador: alcanza con que el ticket tenga jugador o identificador. Es
--   obligatorio solo a nombre de un pasador (sin jugador), cargue quien cargue.
-- * polla_daily_sales suma p_edition_id: sin fecha, el total de la edición (todos
--   los días de carga). Trae el número de grupo y ordena por él.

-- ============================================================
-- 1. Alta de una jugada: identificador obligatorio solo sin jugador
-- ============================================================

DROP FUNCTION IF EXISTS polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT);

CREATE FUNCTION polla_create_bet(
  p_edition_id UUID,
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_numbers TEXT[],
  p_date DATE DEFAULT NULL,
  -- Sin uso: el corte sale del rol del actor. Queda para la API del deploy.
  p_force BOOLEAN DEFAULT FALSE,
  p_free BOOLEAN DEFAULT FALSE,
  p_repeated_from UUID DEFAULT NULL,
  p_identifier TEXT DEFAULT NULL
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
  v_identifier TEXT;
  v_group_number INTEGER;
  v_player_number INTEGER;
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

  -- A nombre de quién carga cada rol: el admin en su grupo, el pasador a él o
  -- a sus jugadores, el jugador a él. ASSISTANT y superadmin+, a cualquiera de
  -- la organización.
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

  -- Todo ticket tiene nombre de jugador o identificador: a nombre de un
  -- jugador el identificador es opcional; a nombre de un pasador (sin
  -- jugador), obligatorio. Una repetición copia el del original (los tickets
  -- viejos no tienen).
  v_identifier := NULLIF(btrim(p_identifier), '');

  IF v_identifier IS NULL
     AND p_repeated_from IS NULL
     AND v_target.user_type = 'CASHIER' THEN
    RAISE EXCEPTION 'POLLA_BET_IDENTIFIER_REQUIRED';
  END IF;

  IF v_target.user_type = 'PLAYER' THEN
    SELECT * INTO v_cashier
    FROM polla_users
    WHERE polla_user_id = v_target.parent_polla_user_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POLLA_PARENT_NOT_FOUND';
    END IF;

    v_player_number := v_target.number;
  ELSE
    v_cashier := v_target;
    v_player_number := 0;
  END IF;

  -- Sin grupo = 0.
  SELECT number INTO v_group_number
  FROM polla_groups
  WHERE polla_group_id = v_cashier.polla_group_id;

  v_amount := CASE WHEN p_free THEN 0 ELSE v_edition.ticket_price END;

  LOOP
    v_attempt := v_attempt + 1;
    v_ticket_number := COALESCE(v_group_number, 0)::TEXT
                       || '-'
                       || to_char(
                            clock_timestamp() AT TIME ZONE 'America/Argentina/Buenos_Aires',
                            'YYYYMMDDHH24MISSMS'
                          )
                       || '-'
                       || COALESCE(v_cashier.number, 0)::TEXT
                       || '-'
                       || COALESCE(v_player_number, 0)::TEXT;

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
        repeated_from_bet_id,
        identifier
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
        p_repeated_from,
        v_identifier
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

REVOKE ALL ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT) TO service_role;

-- ============================================================
-- 2. Ventas: del día o de toda la edición
-- ============================================================

DROP FUNCTION IF EXISTS polla_daily_sales(UUID, DATE, UUID, UUID);
DROP FUNCTION IF EXISTS polla_daily_sales(UUID, DATE, UUID, UUID, UUID);

-- Boletas vendidas por grupo, sin las repetidas sin cargo. Con p_date, las de
-- ese día (de todas las ediciones); con p_edition_id, las de esa edición; con
-- los dos, las de ese día en esa edición. Sin ninguno no trae nada.
CREATE FUNCTION polla_daily_sales(
  p_organization_id UUID,
  p_date DATE,
  p_cashier_id UUID DEFAULT NULL,
  p_group_id UUID DEFAULT NULL,
  p_edition_id UUID DEFAULT NULL
)
RETURNS TABLE (
  polla_group_id UUID,
  group_name TEXT,
  group_number INTEGER,
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
    g.number AS group_number,
    COUNT(*) AS bets_count,
    COALESCE(SUM(b.amount), 0) AS amount
  FROM polla_bets b
  LEFT JOIN polla_groups g ON g.polla_group_id = b.polla_group_id
  WHERE b.polla_organization_id = p_organization_id
    AND (p_date IS NOT NULL OR p_edition_id IS NOT NULL)
    AND (p_date IS NULL OR b.load_date = p_date)
    AND (p_edition_id IS NULL OR b.polla_edition_id = p_edition_id)
    AND b.deleted_at IS NULL
    AND NOT b.is_free
    AND (p_cashier_id IS NULL OR b.cashier_polla_user_id = p_cashier_id)
    AND (p_group_id IS NULL OR b.polla_group_id = p_group_id)
  GROUP BY b.polla_group_id, g.name, g.number
  ORDER BY g.number NULLS LAST;
$$;

REVOKE ALL ON FUNCTION polla_daily_sales(UUID, DATE, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_daily_sales(UUID, DATE, UUID, UUID, UUID) TO service_role;
