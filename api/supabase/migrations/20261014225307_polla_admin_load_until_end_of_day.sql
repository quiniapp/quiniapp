-- Polla: los admin cargan hasta el final del día de cierre.
--
-- Hasta ahora ADMIN y superiores cargaban con `p_force`, que salteaba el cierre
-- de carga: podían cargar en cualquier momento. Ahora tienen el mismo día de
-- cierre que pasadores y jugadores, pero sin la hora: si la edición cierra el
-- viernes 16/10 a las 12:00, el pasador y el jugador cargan hasta esa hora y el
-- admin hasta el viernes 16/10 a las 23:59:59 (hora de Argentina).
--
-- `p_force` conserva el nombre para que la API vieja siga llamando a la RPC
-- durante el deploy. Editar y borrar jugadas no cambia: con force, el admin
-- sigue pudiendo pasado el cierre.

-- ============================================================
-- Alta de una jugada: cierre por fecha y hora, o solo por fecha para ADMIN+
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

  -- Pasador y jugador: hasta la fecha y hora de cierre. ADMIN+ (p_force): hasta
  -- el final del día de cierre, sin mirar la hora.
  IF p_force THEN
    IF polla_today() > v_edition.load_limit_date THEN
      RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
    END IF;
  ELSIF polla_load_closed(v_edition.load_limit_date, v_edition.load_limit_time) THEN
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
