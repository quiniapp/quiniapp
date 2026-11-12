-- R14 (ajuste del cliente, revisión del 10/11): "Eliminar impagos" también
-- para el admin de grupo, el superadmin, el capitalista y el dueño.
--
-- - El pasador sigue igual: lo imputado a él en la edición y, si se pide, de
--   un jugador.
-- - El staff elige de quién: un pasador (lo imputado a él) y/o un jugador. Es
--   obligatorio elegir uno de los dos, para no borrar de una vez todo el grupo
--   o la organización. El admin, solo dentro de su grupo; superadmin+, en toda
--   la organización. El Súper (ASSISTANT) y el jugador, no.
-- - El corte es el mismo para todos: el cierre de carga de la edición (el del
--   pasador).
-- - Nunca se borran ganadoras. La baja se descuenta del pase de cada pasador
--   hoy, o al día siguiente si su cuenta ya se liquidó hoy (Borradas), como el
--   borrado de a uno.

DROP FUNCTION IF EXISTS polla_unpaid_bets_summary(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS polla_delete_unpaid_bets(UUID, UUID, UUID);

-- De quién borra cada rol. `cashier_id`: lo imputado a ese pasador (NULL =
-- cualquiera); `group_id`: tope del admin (NULL = toda la organización).
CREATE OR REPLACE FUNCTION polla_unpaid_bets_scope(
  p_actor polla_users,
  p_cashier_id UUID,
  p_user_id UUID,
  OUT cashier_id UUID,
  OUT group_id UUID
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_target polla_users;
BEGIN
  IF p_actor.user_type NOT IN ('CASHIER', 'ADMIN', 'SUPERADMIN', 'CAPITALIST', 'OWNER') THEN
    RAISE EXCEPTION 'POLLA_UNPAID_DELETE_FORBIDDEN';
  END IF;

  IF p_actor.user_type = 'CASHIER' THEN
    -- El pasador, solo lo suyo.
    IF p_cashier_id IS NOT NULL AND p_cashier_id <> p_actor.polla_user_id THEN
      RAISE EXCEPTION 'POLLA_BET_TARGET_FORBIDDEN';
    END IF;
    cashier_id := p_actor.polla_user_id;
    RETURN;
  END IF;

  IF p_cashier_id IS NULL AND p_user_id IS NULL THEN
    RAISE EXCEPTION 'POLLA_UNPAID_DELETE_TARGET_REQUIRED';
  END IF;

  IF p_actor.user_type = 'ADMIN' THEN
    IF p_actor.polla_group_id IS NULL THEN
      RAISE EXCEPTION 'POLLA_USER_OTHER_GROUP';
    END IF;
    group_id := p_actor.polla_group_id;
  END IF;

  IF p_cashier_id IS NOT NULL THEN
    SELECT * INTO v_target
    FROM polla_users
    WHERE polla_user_id = p_cashier_id
      AND user_type = 'CASHIER'
      AND deleted_at IS NULL
      AND polla_organization_id = p_actor.polla_organization_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
    END IF;
    IF group_id IS NOT NULL AND v_target.polla_group_id IS DISTINCT FROM group_id THEN
      RAISE EXCEPTION 'POLLA_USER_OTHER_GROUP';
    END IF;
    cashier_id := p_cashier_id;
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_target
    FROM polla_users
    WHERE polla_user_id = p_user_id
      AND user_type IN ('PLAYER', 'CASHIER')
      AND deleted_at IS NULL
      AND polla_organization_id = p_actor.polla_organization_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
    END IF;
    IF group_id IS NOT NULL AND v_target.polla_group_id IS DISTINCT FROM group_id THEN
      RAISE EXCEPTION 'POLLA_USER_OTHER_GROUP';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION polla_unpaid_bets_scope(polla_users, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_unpaid_bets_scope(polla_users, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION polla_unpaid_bets_summary(
  p_actor_id UUID,
  p_edition_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_cashier_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_actor polla_users;
  v_edition polla_editions;
  v_cashier_id UUID;
  v_group_id UUID;
  v_cutoff TIMESTAMP;
  v_count INTEGER;
  v_amount NUMERIC(12,2);
  v_winners INTEGER;
BEGIN
  SELECT * INTO v_actor
  FROM polla_users
  WHERE polla_user_id = p_actor_id
    AND deleted_at IS NULL
    AND disabled = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  SELECT s.cashier_id, s.group_id INTO v_cashier_id, v_group_id
  FROM polla_unpaid_bets_scope(v_actor, p_cashier_id, p_user_id) s;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR v_edition.polla_organization_id <> v_actor.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  -- El cierre de carga de la edición, para todos los roles.
  v_cutoff := polla_load_cutoff(v_edition, 'CASHIER');

  SELECT
    COUNT(*) FILTER (WHERE NOT winner),
    COALESCE(SUM(amount) FILTER (WHERE NOT winner), 0),
    COUNT(*) FILTER (WHERE winner)
  INTO v_count, v_amount, v_winners
  FROM polla_bets
  WHERE polla_edition_id = p_edition_id
    AND payment_status = 'OWED'
    AND deleted_at IS NULL
    AND (v_cashier_id IS NULL OR cashier_polla_user_id = v_cashier_id)
    AND (p_user_id IS NULL OR polla_user_id = p_user_id)
    AND (v_group_id IS NULL OR polla_group_id = v_group_id);

  RETURN jsonb_build_object(
    'count', v_count,
    'amount', v_amount,
    -- Ganadoras en Debe: no se borran.
    'winners_skipped', v_winners,
    'cutoff', v_cutoff,
    'can_delete', v_cutoff IS NULL OR polla_now() <= v_cutoff
  );
END;
$$;

CREATE OR REPLACE FUNCTION polla_delete_unpaid_bets(
  p_actor_id UUID,
  p_edition_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_cashier_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor polla_users;
  v_edition polla_editions;
  v_cashier_id UUID;
  v_group_id UUID;
  v_cutoff TIMESTAMP;
  v_deleted INTEGER;
  v_amount NUMERIC(12,2);
  v_refresh JSONB;
  v_deducted_on DATE;
  v_item JSONB;
BEGIN
  SELECT * INTO v_actor
  FROM polla_users
  WHERE polla_user_id = p_actor_id
    AND deleted_at IS NULL
    AND disabled = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  SELECT s.cashier_id, s.group_id INTO v_cashier_id, v_group_id
  FROM polla_unpaid_bets_scope(v_actor, p_cashier_id, p_user_id) s;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_edition.polla_organization_id <> v_actor.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  -- El mismo corte que el borrado de a uno del pasador, para todos los roles.
  v_cutoff := polla_load_cutoff(v_edition, 'CASHIER');
  IF v_cutoff IS NOT NULL AND polla_now() > v_cutoff THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  -- Cada baja se descuenta hoy; si la cuenta de su pasador ya se liquidó hoy,
  -- al día siguiente: lo liquidado no cambia (como `polla_delete_bet`).
  WITH deleted AS (
    UPDATE polla_bets b
    SET deleted_at = NOW(),
        deleted_by = p_actor_id,
        deducted_on = GREATEST(
          polla_today(),
          COALESCE(
            (
              SELECT MAX(ca.date) + 1
              FROM polla_current_accounts ca
              WHERE ca.polla_user_id = b.cashier_polla_user_id
                AND ca.is_liquidated
            ),
            polla_today()
          )
        )
    WHERE b.polla_edition_id = p_edition_id
      AND b.payment_status = 'OWED'
      AND b.deleted_at IS NULL
      AND NOT b.winner
      AND (v_cashier_id IS NULL OR b.cashier_polla_user_id = v_cashier_id)
      AND (p_user_id IS NULL OR b.polla_user_id = p_user_id)
      AND (v_group_id IS NULL OR b.polla_group_id = v_group_id)
    RETURNING b.amount, b.cashier_polla_user_id, b.deducted_on
  )
  SELECT
    COUNT(*),
    COALESCE(SUM(amount), 0),
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object('cashier', cashier_polla_user_id, 'date', deducted_on)),
      '[]'::JSONB
    ),
    MAX(deducted_on)
  INTO v_deleted, v_amount, v_refresh, v_deducted_on
  FROM deleted;

  IF v_deleted > 0 THEN
    UPDATE polla_editions
    SET bets_count = GREATEST(bets_count - v_deleted, 0),
        collected_amount = GREATEST(collected_amount - v_amount, 0),
        edited_at = NOW()
    WHERE polla_edition_id = p_edition_id;

    -- La fila de Borradas de cada pasador tocado.
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_refresh) LOOP
      PERFORM polla_refresh_current_account_row(
        (v_item->>'cashier')::UUID,
        (v_item->>'date')::DATE,
        v_actor.polla_organization_id
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', v_deleted,
    'amount', v_amount,
    'deducted_on', COALESCE(v_deducted_on, polla_today())
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_unpaid_bets_summary(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_unpaid_bets_summary(UUID, UUID, UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_delete_unpaid_bets(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_delete_unpaid_bets(UUID, UUID, UUID, UUID) TO service_role;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS polla_delete_unpaid_bets(UUID, UUID, UUID, UUID);
-- DROP FUNCTION IF EXISTS polla_unpaid_bets_summary(UUID, UUID, UUID, UUID);
-- DROP FUNCTION IF EXISTS polla_unpaid_bets_scope(polla_users, UUID, UUID);
-- Volver a crear `polla_unpaid_bets_summary` y `polla_delete_unpaid_bets` con
-- las definiciones de 20261105150000_polla_delete_unpaid_bets.sql (solo el
-- pasador). Los tickets que se borraron quedan borrados.
