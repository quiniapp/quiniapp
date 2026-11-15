-- Pasador deshabilitado: sus jugadores quedan frenados.
--
-- Mientras un pasador está deshabilitado, sus jugadores no entran ni cargan, y
-- nadie les carga (ni el staff, ni repetir, ni cortesía). No se los marca uno
-- por uno: vuelven solos cuando se habilita al pasador. La sesión y el login
-- los frena la API; acá se frena la carga.
--
-- - `polla_create_bet`: si el destinatario es un jugador y su pasador está
--   deshabilitado → `POLLA_CASHIER_DISABLED`. Repetir y cortesía cargan con
--   esta función, así que el ticket queda en "No se repitieron".
-- - `polla_revoke_player_sessions`: cierra las sesiones activas de los
--   jugadores de un pasador (la API la llama al deshabilitarlo).

-- ------------------------------------------------------------ cargar

-- Igual que en 20261115140021_polla_courtesy_staff_roles.sql; se agrega el
-- control del pasador del jugador (`POLLA_CASHIER_DISABLED`).
CREATE OR REPLACE FUNCTION polla_create_bet(
  p_edition_id UUID,
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_numbers TEXT[],
  p_date DATE DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE,
  p_free BOOLEAN DEFAULT FALSE,
  p_repeated_from UUID DEFAULT NULL,
  p_identifier TEXT DEFAULT NULL,
  p_payment_status polla_payment_status_enum DEFAULT NULL
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
  v_payment polla_payment_status_enum;
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

  IF p_free AND v_actor.user_type NOT IN ('OWNER', 'CAPITALIST', 'SUPERADMIN', 'ASSISTANT') THEN
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

    IF v_cashier.disabled THEN
      RAISE EXCEPTION 'POLLA_CASHIER_DISABLED';
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

  -- R04: lo repetido sin cargo no tiene nada que cobrar; el jugador carga
  -- siempre en Debe (lo cobra su pasador); el resto elige, Efectivo si no dice.
  v_payment := CASE
    WHEN p_free THEN 'PAID'
    WHEN v_actor.user_type = 'PLAYER' THEN 'OWED'
    ELSE COALESCE(p_payment_status, 'PAID')
  END;

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
        identifier,
        payment_status,
        payment_method,
        paid_at,
        paid_by
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
        v_identifier,
        v_payment,
        CASE WHEN v_payment = 'PAID' AND NOT COALESCE(p_free, FALSE) THEN 'CASH' END::polla_payment_method_enum,
        CASE WHEN v_payment = 'PAID' THEN NOW() END,
        CASE WHEN v_payment = 'PAID' THEN p_actor_user_id END
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

REVOKE ALL ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT, polla_payment_status_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT, polla_payment_status_enum) TO service_role;

-- ------------------------------------------------------------ sesiones

-- Cierra las sesiones activas de los jugadores del pasador. Devuelve cuántas.
CREATE FUNCTION polla_revoke_player_sessions(p_cashier_id UUID)
RETURNS INTEGER
LANGUAGE sql
SET search_path = public
AS $$
  WITH revoked AS (
    UPDATE polla_sessions s
    SET is_active = FALSE,
        revoked_at = NOW()
    FROM polla_users u
    WHERE u.polla_user_id = s.polla_user_id
      AND u.parent_polla_user_id = p_cashier_id
      AND u.user_type = 'PLAYER'
      AND s.is_active
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER FROM revoked;
$$;

REVOKE ALL ON FUNCTION polla_revoke_player_sessions(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_revoke_player_sessions(UUID) TO service_role;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS polla_revoke_player_sessions(UUID);
-- Volver a crear `polla_create_bet` con su definición anterior (sin el control
-- del pasador del jugador): 20261115140021_polla_courtesy_staff_roles.sql.
