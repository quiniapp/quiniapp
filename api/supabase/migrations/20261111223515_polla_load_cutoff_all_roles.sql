-- R30: el cierre de carga rige para todos los roles.
--
-- Hasta ahora dueño, capitalista y superadmin no tenían corte (cargaban hasta
-- el último día de juego, con los sorteos en curso) y el Súper cargaba hasta
-- el último turno del día de cierre. Ahora:
--
-- - Dueño, capitalista, superadmin, Súper, pasador y jugador cargan, repiten y
--   editan números hasta el cierre de carga de la edición.
-- - El admin de grupo carga hasta la hora del sorteo (lo pidió el cliente).
-- - Tope duro para todos: la hora del primer sorteo del día de inicio, aunque
--   el cierre esté mal configurado. Así funcionan también las ediciones que se
--   cargan y se sortean el mismo sábado (no hay corte a las 00 h).
-- - Borrar de a uno: superadmin+ sigue pudiendo siempre (para corregir); el
--   resto, hasta su corte, como antes.

-- Momento (hora de Argentina) hasta el que el rol carga en la edición.
CREATE OR REPLACE FUNCTION polla_load_cutoff(
  p_edition polla_editions,
  p_role polla_user_type_enum
)
RETURNS TIMESTAMP
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_first_draw TIME;
  v_draw_start TIMESTAMP;
BEGIN
  -- El primer sorteo del día de inicio: el turno más temprano de la edición.
  SELECT MIN(s.time) INTO v_first_draw
  FROM polla_edition_draws d
  JOIN polla_schedules s ON s.polla_schedule_id = d.polla_schedule_id
  WHERE d.polla_edition_id = p_edition.polla_edition_id;

  IF v_first_draw IS NULL THEN
    SELECT time INTO v_first_draw
    FROM polla_schedules
    WHERE polla_schedule_id = p_edition.polla_schedule_id;
  END IF;

  v_draw_start := p_edition.start_date + COALESCE(v_first_draw, '00:00'::TIME);

  -- El admin de grupo, hasta la hora del sorteo.
  IF p_role = 'ADMIN' THEN
    RETURN v_draw_start;
  END IF;

  RETURN LEAST(p_edition.load_limit_date + p_edition.load_limit_time, v_draw_start);
END;
$$;

REVOKE ALL ON FUNCTION polla_load_cutoff(polla_editions, polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_load_cutoff(polla_editions, polla_user_type_enum) TO service_role;

-- ¿Puede el actor modificar esta jugada ahora? Editar números: cada rol hasta
-- su corte (superadmin+ también). Borrar: superadmin+ siempre; el resto, hasta
-- su corte.
CREATE OR REPLACE FUNCTION polla_assert_bet_writable(
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

  IF p_actor.user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN') THEN
    -- Borrar, siempre (para corregir). Editar números, hasta el cierre (R30).
    IF NOT p_editing THEN
      RETURN;
    END IF;
  ELSIF p_actor.user_type = 'ADMIN' THEN
    IF p_actor.polla_group_id IS NULL
       OR p_bet.polla_group_id IS DISTINCT FROM p_actor.polla_group_id THEN
      RAISE EXCEPTION 'POLLA_USER_OTHER_GROUP';
    END IF;
  ELSIF p_actor.user_type = 'ASSISTANT' THEN
    -- Toda la organización (ya controlada arriba).
    NULL;
  ELSIF p_actor.user_type = 'CASHIER' AND NOT p_editing THEN
    IF p_bet.cashier_polla_user_id <> p_actor.polla_user_id THEN
      RAISE EXCEPTION 'POLLA_BET_TARGET_FORBIDDEN';
    END IF;
  ELSE
    -- El pasador no edita; el jugador no modifica nada.
    RAISE EXCEPTION 'POLLA_BET_WRITE_FORBIDDEN';
  END IF;

  v_cutoff := polla_load_cutoff(p_edition, p_actor.user_type);
  IF polla_now() > v_cutoff THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION polla_assert_bet_writable(polla_bets, polla_users, polla_editions, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_assert_bet_writable(polla_bets, polla_users, polla_editions, BOOLEAN) TO service_role;

-- ROLLBACK:
-- Volver a crear `polla_load_cutoff` y `polla_assert_bet_writable` con las
-- definiciones de 20261027221619_polla_group_numbers_street_users.sql
-- (superadmin+ sin corte; admin y Súper hasta el último turno del día de
-- cierre, con tope en el primer sorteo).
