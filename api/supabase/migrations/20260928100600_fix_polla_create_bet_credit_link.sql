-- polla_create_bet enlazaba el movimiento de crédito con la jugada buscando
-- "el último movimiento BET sin jugada" de ese jugador. Con dos cargas
-- simultáneas del mismo jugador esa subconsulta puede elegir el movimiento de
-- la otra. Ahora se usa el id que devuelve polla_adjust_credits.

CREATE OR REPLACE FUNCTION polla_create_bet(
  p_edition_id UUID,
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_numbers TEXT[],
  p_date DATE DEFAULT CURRENT_DATE,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
  v_target polla_users;
  v_cashier polla_users;
  v_ticket_number TEXT;
  v_bet polla_bets;
  v_attempt INTEGER := 0;
  v_credit JSONB;
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

  IF p_date > v_edition.load_limit_date AND NOT p_force THEN
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

    v_credit := polla_adjust_credits(
      v_target.polla_user_id,
      -v_edition.ticket_price,
      'BET',
      NULL,
      p_actor_user_id,
      NULL
    );
  ELSE
    v_cashier := v_target;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_ticket_number := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
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
        numbers
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
        p_date,
        v_edition.ticket_price,
        p_numbers
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

  IF v_credit IS NOT NULL THEN
    UPDATE polla_credit_movements
    SET polla_bet_id = v_bet.polla_bet_id
    WHERE polla_credit_movement_id = (v_credit->>'polla_credit_movement_id')::UUID;
  END IF;

  UPDATE polla_editions
  SET bets_count = bets_count + 1,
      collected_amount = collected_amount + v_edition.ticket_price,
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id;

  RETURN jsonb_build_object('success', true, 'bet', to_jsonb(v_bet));
END;
$$;
