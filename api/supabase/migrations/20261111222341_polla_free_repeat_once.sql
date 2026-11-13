-- R33: un ticket se repite de cortesía (sin cargo) una sola vez.
--
-- - Si el ticket ya tiene una cortesía vigente, no se le hace otra. Para
--   corregir una cortesía cargada en la edición equivocada se la borra y se
--   vuelve a repetir: la borrada ya no cuenta.
-- - Una cortesía no se repite de cortesía.
-- - Los tickets que ya tenían dos o más cortesías quedan como están (no se
--   borra nada); desde ahora no suman otra.
--
-- La regla vive en un trigger (vale para cualquier camino que cree una
-- cortesía) que bloquea la fila del ticket original, así dos repeticiones a la
-- vez no generan dos cortesías. `polla_repeat_bets` la controla antes para
-- devolver en qué edición y con qué ticket está la cortesía.

-- ------------------------------------------------------------ trigger

CREATE OR REPLACE FUNCTION polla_assert_free_repeat_once()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_source polla_bets;
BEGIN
  IF NOT NEW.is_free OR NEW.repeated_from_bet_id IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Una cortesía por vez para el mismo ticket.
  SELECT * INTO v_source
  FROM polla_bets
  WHERE polla_bet_id = NEW.repeated_from_bet_id
  FOR UPDATE;

  IF FOUND AND v_source.is_free THEN
    RAISE EXCEPTION 'POLLA_FREE_REPEAT_OF_COURTESY';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM polla_bets c
    WHERE c.repeated_from_bet_id = NEW.repeated_from_bet_id
      AND c.is_free
      AND c.deleted_at IS NULL
      AND c.polla_bet_id <> NEW.polla_bet_id
  ) THEN
    RAISE EXCEPTION 'POLLA_BET_ALREADY_COURTESY';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION polla_assert_free_repeat_once() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_polla_free_repeat_once ON polla_bets;
CREATE TRIGGER trg_polla_free_repeat_once
  BEFORE INSERT ON polla_bets
  FOR EACH ROW EXECUTE FUNCTION polla_assert_free_repeat_once();

-- La cortesía vigente de un ticket (la más nueva, si quedaron varias de antes).
CREATE OR REPLACE FUNCTION polla_bet_courtesy(p_bet_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'polla_bet_id', c.polla_bet_id,
    'ticket_number', c.ticket_number,
    'polla_edition_id', c.polla_edition_id
  )
  FROM polla_bets c
  WHERE c.repeated_from_bet_id = p_bet_id
    AND c.is_free
    AND c.deleted_at IS NULL
  ORDER BY c.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION polla_bet_courtesy(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_bet_courtesy(UUID) TO service_role;

-- ------------------------------------------------- repetir (sin cargo)

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

-- ROLLBACK:
-- DROP TRIGGER IF EXISTS trg_polla_free_repeat_once ON polla_bets;
-- DROP FUNCTION IF EXISTS polla_assert_free_repeat_once();
-- DROP FUNCTION IF EXISTS polla_bet_courtesy(UUID);
-- Volver a crear `polla_repeat_bets` con la definición de
-- 20261105130000_polla_bet_payment_status.sql (sin los controles de R33).
