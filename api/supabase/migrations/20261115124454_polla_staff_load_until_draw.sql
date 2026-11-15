-- Ajuste de R30: dueño, capitalista, superadmin y Súper cargan hasta el sorteo.
--
-- Hasta ahora (20261111223515) todos cortaban en el cierre de carga salvo el
-- admin de grupo, que cargaba hasta la hora del sorteo. Ahora, con "sorteo" =
-- la hora del primer sorteo del día de inicio (el turno más temprano de la
-- edición):
--
-- | Rol                             | Cargar  | Editar números | Repetir | Borrar de a uno |
-- | Dueño, capitalista, superadmin  | sorteo  | sorteo         | cierre  | siempre         |
-- | Súper                           | sorteo  | cierre         | sorteo  | sorteo          |
-- | Admin de grupo, pasador         | cierre  | cierre         | cierre  | cierre          |
-- | Jugador                         | cierre  | -              | cierre  | -               |
--
-- - El admin de grupo, que cargaba hasta el sorteo, pasa a cortar en el
--   cierre de carga.
-- - Repetir es con cargo y de cortesía (la cortesía solo la hacen superadmin+
--   y el admin de grupo).
-- - El cierre de carga sigue con tope en el primer sorteo, aunque esté mal
--   configurado.
-- - La liquidación por edición se sigue habilitando desde el cierre de carga
--   (antes tomaba el corte del dueño, que ahora es la hora del sorteo). Lo que
--   el staff cargue entre el cierre y el sorteo aparece como diferencia al
--   volver a liquidar.
-- - Borrar de a uno: superadmin+ siempre, sin cambios.
-- - Eliminar impagos sigue cortando en el cierre de carga (usa el corte del
--   pasador), sin cambios.

-- ------------------------------------------------------------ cortes

-- Hora del primer sorteo del día de inicio (hora de Argentina): el turno más
-- temprano entre los sorteos de la edición.
CREATE OR REPLACE FUNCTION polla_edition_draw_start(p_edition polla_editions)
RETURNS TIMESTAMP
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_first_draw TIME;
BEGIN
  SELECT MIN(s.time) INTO v_first_draw
  FROM polla_edition_draws d
  JOIN polla_schedules s ON s.polla_schedule_id = d.polla_schedule_id
  WHERE d.polla_edition_id = p_edition.polla_edition_id;

  IF v_first_draw IS NULL THEN
    SELECT time INTO v_first_draw
    FROM polla_schedules
    WHERE polla_schedule_id = p_edition.polla_schedule_id;
  END IF;

  RETURN p_edition.start_date + COALESCE(v_first_draw, '00:00'::TIME);
END;
$$;

REVOKE ALL ON FUNCTION polla_edition_draw_start(polla_editions) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_draw_start(polla_editions) TO service_role;

-- Cierre de carga de la edición (hora de Argentina): el configurado, con tope
-- en el primer sorteo del día de inicio.
CREATE OR REPLACE FUNCTION polla_edition_load_close(p_edition polla_editions)
RETURNS TIMESTAMP
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT LEAST(
    p_edition.load_limit_date + p_edition.load_limit_time,
    polla_edition_draw_start(p_edition)
  );
$$;

REVOKE ALL ON FUNCTION polla_edition_load_close(polla_editions) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_load_close(polla_editions) TO service_role;

-- Momento (hora de Argentina) hasta el que el rol carga jugadas nuevas en la
-- edición. También es el corte de borrar de a uno para los que no son
-- superadmin+ (`polla_assert_bet_writable`).
CREATE OR REPLACE FUNCTION polla_load_cutoff(
  p_edition polla_editions,
  p_role polla_user_type_enum
)
RETURNS TIMESTAMP
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  -- Dueño, capitalista, superadmin y Súper, hasta la hora del sorteo.
  IF p_role IN ('OWNER', 'CAPITALIST', 'SUPERADMIN', 'ASSISTANT') THEN
    RETURN polla_edition_draw_start(p_edition);
  END IF;

  -- El resto (admin de grupo incluido), hasta el cierre de carga.
  RETURN polla_edition_load_close(p_edition);
END;
$$;

REVOKE ALL ON FUNCTION polla_load_cutoff(polla_editions, polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_load_cutoff(polla_editions, polla_user_type_enum) TO service_role;

-- Hasta cuándo el rol edita números: dueño, capitalista y superadmin, hasta la
-- hora del sorteo; el resto (el Súper incluido), hasta el cierre de carga.
CREATE OR REPLACE FUNCTION polla_edit_cutoff(
  p_edition polla_editions,
  p_role polla_user_type_enum
)
RETURNS TIMESTAMP
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role IN ('OWNER', 'CAPITALIST', 'SUPERADMIN') THEN polla_edition_draw_start(p_edition)
    ELSE polla_edition_load_close(p_edition)
  END;
$$;

REVOKE ALL ON FUNCTION polla_edit_cutoff(polla_editions, polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edit_cutoff(polla_editions, polla_user_type_enum) TO service_role;

-- Hasta cuándo el rol repite (con cargo o de cortesía): el Súper, hasta la
-- hora del sorteo; el resto (dueño, capitalista y superadmin incluidos), hasta
-- el cierre de carga.
CREATE OR REPLACE FUNCTION polla_repeat_cutoff(
  p_edition polla_editions,
  p_role polla_user_type_enum
)
RETURNS TIMESTAMP
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role = 'ASSISTANT' THEN polla_edition_draw_start(p_edition)
    ELSE polla_edition_load_close(p_edition)
  END;
$$;

REVOKE ALL ON FUNCTION polla_repeat_cutoff(polla_editions, polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_repeat_cutoff(polla_editions, polla_user_type_enum) TO service_role;

-- Igual que en 20261111223001; agrega `can_edit`: si el rol todavía edita
-- números en la edición (el Súper carga y borra hasta el sorteo, pero edita
-- hasta el cierre). La API arma con esto las acciones de cada jugada.
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
  can_load BOOLEAN,
  can_edit BOOLEAN
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
    polla_can_load(e, p_role),
    polla_can_load(e, p_role) AND polla_now() <= polla_edit_cutoff(e, p_role)
  FROM polla_editions e
  WHERE e.polla_edition_id = ANY (p_edition_ids);
$$;

REVOKE ALL ON FUNCTION polla_editions_load_state(UUID[], polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_editions_load_state(UUID[], polla_user_type_enum) TO service_role;

-- Igual que en 20261111223515; editar números usa `polla_edit_cutoff` (el
-- Súper edita hasta el cierre) y borrar, `polla_load_cutoff` (el Súper borra
-- hasta el sorteo; admin de grupo y pasador, hasta el cierre).
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
    -- Borrar, siempre (para corregir). Editar números, hasta el sorteo.
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

  v_cutoff := CASE
    WHEN p_editing THEN polla_edit_cutoff(p_edition, p_actor.user_type)
    ELSE polla_load_cutoff(p_edition, p_actor.user_type)
  END;
  IF polla_now() > v_cutoff THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION polla_assert_bet_writable(polla_bets, polla_users, polla_editions, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_assert_bet_writable(polla_bets, polla_users, polla_editions, BOOLEAN) TO service_role;

-- ------------------------------------------------------------ ediciones para cargar

-- Igual que en 20261105090000; agrega `can_repeat`: si el rol todavía repite
-- en la edición (`polla_repeat_cutoff`). Con eso la web no ofrece repetir en
-- una edición donde el rol carga pero ya no repite.
CREATE OR REPLACE FUNCTION polla_loadable_editions(p_organization_id UUID, p_role polla_user_type_enum)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT polla_edition_with_draws(e) || jsonb_build_object(
    'my_load_cutoff', polla_load_cutoff(e, p_role),
    'can_repeat', polla_now() <= polla_repeat_cutoff(e, p_role)
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

-- ------------------------------------------------------------ repetir

-- Igual que en 20261111222341; agrega el corte de repetir
-- (`polla_repeat_cutoff`): dueño, capitalista y superadmin cargan hasta el
-- sorteo, pero no repiten después del cierre; el Súper repite hasta el sorteo.
CREATE OR REPLACE FUNCTION polla_repeat_bets(
  p_actor_id UUID,
  p_edition_id UUID,
  p_bet_ids UUID[],
  p_free BOOLEAN DEFAULT FALSE,
  p_payment_status polla_payment_status_enum DEFAULT NULL
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
  v_courtesy JSONB;
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

  -- Repetir (con cargo o de cortesía) tiene su propio corte.
  IF polla_now() > polla_repeat_cutoff(v_edition, v_actor.user_type) THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  FOR v_source_id IN SELECT DISTINCT unnest(p_bet_ids)
  LOOP
    v_reason := NULL;
    v_courtesy := NULL;

    SELECT * INTO v_source
    FROM polla_bets
    WHERE polla_bet_id = v_source_id
      AND deleted_at IS NULL;

    -- ASSISTANT y superadmin+: cualquiera de la organización.
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
      ELSIF v_source.is_free THEN
        -- R33: una cortesía no se repite de cortesía.
        v_reason := 'POLLA_FREE_REPEAT_OF_COURTESY';
      ELSE
        -- R33: una sola cortesía por ticket (el trigger lo vuelve a controlar).
        PERFORM 1 FROM polla_bets WHERE polla_bet_id = v_source_id FOR UPDATE;
        v_courtesy := polla_bet_courtesy(v_source_id);
        IF v_courtesy IS NOT NULL THEN
          v_reason := 'POLLA_BET_ALREADY_COURTESY';
        END IF;
      END IF;
    END IF;

    IF v_reason IS NULL THEN
      BEGIN
        -- El pago se elige para todo el lote (el jugador, siempre Debe; sin
        -- cargo, pagado: lo resuelve polla_create_bet).
        v_result := polla_create_bet(
          p_edition_id,
          p_actor_id,
          v_source.polla_user_id,
          v_source.numbers,
          NULL,
          FALSE,
          p_free,
          v_source.polla_bet_id,
          v_source.identifier,
          p_payment_status
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
        'reason', v_reason,
        -- Dónde está la cortesía que ya tiene (R33).
        'courtesy', v_courtesy
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN, polla_payment_status_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN, polla_payment_status_enum) TO service_role;

-- ------------------------------------------------------------ liquidación por edición

-- Igual que en 20261114141228; la liquidación se habilita desde el cierre de
-- carga (antes, el corte del dueño, que ahora es la hora del sorteo).
CREATE OR REPLACE FUNCTION polla_liquidate_edition_accounts(
  p_organization_id UUID,
  p_edition_id UUID,
  p_user_ids UUID[],
  p_actor_id UUID,
  p_ticket_source TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
  v_differences JSONB;
  v_liquidations JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('polla-edition-liq:' || p_edition_id));

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND polla_organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF NOT v_edition.account_by_edition THEN
    RAISE EXCEPTION 'POLLA_EDITION_ACCOUNT_DISABLED';
  END IF;

  IF polla_now() < polla_edition_load_close(v_edition) THEN
    RAISE EXCEPTION 'POLLA_EDITION_LOAD_OPEN';
  END IF;

  IF p_ticket_source IS NOT NULL AND p_ticket_source NOT IN ('NEW', 'OLD') THEN
    RAISE EXCEPTION 'POLLA_EDITION_LIQUIDATION_SOURCE_INVALID';
  END IF;

  IF COALESCE(cardinality(p_user_ids), 0) = 0 THEN
    RAISE EXCEPTION 'POLLA_EDITION_LIQUIDATION_EMPTY';
  END IF;

  -- La cuenta se calcula una sola vez y la usan el control de pasadores, el
  -- aviso de diferencias y la foto: un ticket que cambia entre una sentencia
  -- y otra no puede dejarlas en desacuerdo. La tabla vive hasta el fin de la
  -- transacción; si ya existe (otra liquidación en la misma), se rehace.
  IF to_regclass('pg_temp.polla_liquidation_base') IS NOT NULL THEN
    DROP TABLE pg_temp.polla_liquidation_base;
  END IF;
  CREATE TEMP TABLE polla_liquidation_base ON COMMIT DROP AS
  SELECT * FROM polla_edition_account_base(p_organization_id, p_edition_id);

  IF EXISTS (
    SELECT 1
    FROM unnest(p_user_ids) AS x(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM polla_liquidation_base b
      WHERE b.polla_user_id = x.id
    )
  ) THEN
    RAISE EXCEPTION 'POLLA_ACCOUNT_USER_NOT_CASHIER';
  END IF;

  -- Sin origen elegido, si hay diferencias contra la vigente no se escribe.
  IF p_ticket_source IS NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
      'polla_user_id', b.polla_user_id,
      'user_name', b.user_name,
      'user_number', b.user_number,
      'polla_group_id', b.polla_group_id,
      'old', jsonb_build_object(
        'bets_pass', b.bets_pass, 'deleted_pass', b.deleted_pass, 'fee', b.fee, 'total', b.total),
      'new', jsonb_build_object(
        'bets_pass', b.live_bets_pass, 'deleted_pass', b.live_deleted_pass, 'fee', b.live_fee,
        'total', b.live_total)
    ) ORDER BY b.user_number)
    INTO v_differences
    FROM polla_liquidation_base b
    WHERE b.polla_user_id = ANY (p_user_ids)
      AND b.differs;

    IF v_differences IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'DIFFERENCES', 'differences', v_differences);
    END IF;
  END IF;

  WITH inserted AS (
    INSERT INTO polla_edition_liquidations (
      polla_organization_id, polla_edition_id, polla_user_id, user_name, user_number, polla_group_id,
      fee, bets_pass, deleted_pass, claims, pass, cashier_commission, subtotal, collections, paid, total,
      kept_previous_tickets, created_by, created_at
    )
    SELECT
      p_organization_id, p_edition_id, b.polla_user_id, b.user_name, b.user_number, b.live_group_id,
      CASE WHEN keep.v THEN b.fee ELSE b.live_fee END,
      CASE WHEN keep.v THEN b.bets_pass ELSE b.live_bets_pass END,
      CASE WHEN keep.v THEN b.deleted_pass ELSE b.live_deleted_pass END,
      b.claims,
      CASE WHEN keep.v THEN b.pass ELSE b.live_pass END,
      CASE WHEN keep.v THEN b.cashier_commission ELSE b.live_cashier_commission END,
      CASE WHEN keep.v THEN b.subtotal ELSE b.live_subtotal END,
      b.collections, b.paid,
      CASE WHEN keep.v THEN b.total ELSE b.live_total END,
      keep.v, p_actor_id,
      -- Orden estable dentro de una misma transacción.
      clock_timestamp()
    FROM polla_liquidation_base b
    -- Sin origen elegido, `differs` es FALSE (si no, ya avisó las diferencias).
    CROSS JOIN LATERAL (SELECT p_ticket_source = 'OLD' AND b.differs AS v) keep
    WHERE b.polla_user_id = ANY (p_user_ids)
    RETURNING *
  )
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.user_number) INTO v_liquidations FROM inserted i;

  RETURN jsonb_build_object('status', 'LIQUIDATED', 'liquidations', COALESCE(v_liquidations, '[]'::JSONB));
END;
$$;

REVOKE ALL ON FUNCTION polla_liquidate_edition_accounts(UUID, UUID, UUID[], UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_liquidate_edition_accounts(UUID, UUID, UUID[], UUID, TEXT) TO service_role;

-- Igual que en 20261114141228; la lista ("Pollas a liquidar" y "Liquidaciones
-- realizadas") muestra la edición desde el cierre de carga.
CREATE OR REPLACE FUNCTION polla_edition_account_list(p_organization_id UUID)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'polla_edition_id', e.polla_edition_id,
    'liquidated_at', e.liquidated_at,
    'liquidated_by_name', lb.name,
    'cashiers_count', t.cashiers_count,
    'liquidated_count', t.liquidated_count,
    'owed', t.owed
  )
  FROM polla_editions e
  LEFT JOIN polla_users lb ON lb.polla_user_id = e.liquidated_by
  CROSS JOIN LATERAL (
    SELECT
      (count(*) FILTER (WHERE b.bets_pass <> 0 OR b.deleted_pass <> 0 OR b.claims <> 0
                          OR b.collections <> 0 OR b.paid <> 0))::INTEGER AS cashiers_count,
      (count(*) FILTER (WHERE b.liquidation_id IS NOT NULL))::INTEGER AS liquidated_count,
      COALESCE(SUM(b.total), 0)::NUMERIC(12,2) AS owed
    FROM polla_edition_account_base(e.polla_organization_id, e.polla_edition_id) b
  ) t
  WHERE e.polla_organization_id = p_organization_id
    AND e.account_by_edition
    AND e.deleted_at IS NULL
    AND polla_now() >= polla_edition_load_close(e)
  ORDER BY e.start_date DESC;
$$;

REVOKE ALL ON FUNCTION polla_edition_account_list(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_account_list(UUID) TO service_role;

-- ROLLBACK:
-- 1. Volver a crear, con sus definiciones anteriores:
--    - `polla_load_cutoff` y `polla_assert_bet_writable`:
--      20261111223515_polla_load_cutoff_all_roles.sql (todos hasta el cierre;
--      el admin de grupo, hasta el sorteo).
--    - `polla_editions_load_state` (sin `can_edit`; hay que borrarla antes con
--      DROP FUNCTION porque cambia lo que devuelve):
--      20261111223001_polla_load_start.sql.
--    - `polla_loadable_editions`: 20261105090000_polla_edition_draws_min_hits.sql
--      (sin `can_repeat`).
--    - `polla_repeat_bets`: 20261111222341_polla_free_repeat_once.sql.
--    - `polla_liquidate_edition_accounts` y `polla_edition_account_list`:
--      20261114141228_polla_edition_account_functions.sql.
-- 2. Después, borrar las funciones nuevas:
--    DROP FUNCTION IF EXISTS polla_repeat_cutoff(polla_editions, polla_user_type_enum);
--    DROP FUNCTION IF EXISTS polla_edit_cutoff(polla_editions, polla_user_type_enum);
--    DROP FUNCTION IF EXISTS polla_edition_load_close(polla_editions);
--    DROP FUNCTION IF EXISTS polla_edition_draw_start(polla_editions);
