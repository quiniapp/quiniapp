-- R14: el pasador borra de una vez los tickets que no le pagaron.
--
-- Solo el pasador, solo lo imputado a él (lo suyo y lo de sus jugadores), en
-- la edición elegida y, si se pide, de un jugador. Borra los que están en Debe,
-- vigentes y que no ganaron (una ganadora nunca se borra). Mismo corte que el
-- borrado de a uno (`polla_delete_bet`): hasta el cierre de carga de la edición
-- para el pasador. Igual que ahí, la baja se descuenta del pase hoy, o al día
-- siguiente si su cuenta ya se liquidó hoy (Borradas).
--
-- `polla_unpaid_bets_summary` dice cuántos y cuánto antes de confirmar.

CREATE OR REPLACE FUNCTION polla_unpaid_bets_summary(
  p_actor_id UUID,
  p_edition_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_actor polla_users;
  v_edition polla_editions;
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

  IF v_actor.user_type <> 'CASHIER' THEN
    RAISE EXCEPTION 'POLLA_UNPAID_DELETE_ONLY_CASHIER';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR v_edition.polla_organization_id <> v_actor.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  v_cutoff := polla_load_cutoff(v_edition, 'CASHIER');

  SELECT
    COUNT(*) FILTER (WHERE NOT winner),
    COALESCE(SUM(amount) FILTER (WHERE NOT winner), 0),
    COUNT(*) FILTER (WHERE winner)
  INTO v_count, v_amount, v_winners
  FROM polla_bets
  WHERE polla_edition_id = p_edition_id
    AND cashier_polla_user_id = v_actor.polla_user_id
    AND payment_status = 'OWED'
    AND deleted_at IS NULL
    AND (p_user_id IS NULL OR polla_user_id = p_user_id);

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
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor polla_users;
  v_edition polla_editions;
  v_cutoff TIMESTAMP;
  v_deducted_on DATE;
  v_deleted INTEGER;
  v_amount NUMERIC(12,2);
BEGIN
  SELECT * INTO v_actor
  FROM polla_users
  WHERE polla_user_id = p_actor_id
    AND deleted_at IS NULL
    AND disabled = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  IF v_actor.user_type <> 'CASHIER' THEN
    RAISE EXCEPTION 'POLLA_UNPAID_DELETE_ONLY_CASHIER';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_edition.polla_organization_id <> v_actor.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  -- El mismo corte que el borrado de a uno (`polla_assert_bet_writable`).
  v_cutoff := polla_load_cutoff(v_edition, 'CASHIER');
  IF v_cutoff IS NOT NULL AND polla_now() > v_cutoff THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  -- La baja se descuenta hoy; si la cuenta del pasador ya se liquidó hoy, al
  -- día siguiente: lo liquidado no cambia (como `polla_delete_bet`).
  SELECT GREATEST(polla_today(), MAX(ca.date) + 1)
  INTO v_deducted_on
  FROM polla_current_accounts ca
  WHERE ca.polla_user_id = v_actor.polla_user_id
    AND ca.is_liquidated;

  WITH deleted AS (
    UPDATE polla_bets
    SET deleted_at = NOW(),
        deleted_by = p_actor_id,
        deducted_on = v_deducted_on
    WHERE polla_edition_id = p_edition_id
      AND cashier_polla_user_id = v_actor.polla_user_id
      AND payment_status = 'OWED'
      AND deleted_at IS NULL
      AND NOT winner
      AND (p_user_id IS NULL OR polla_user_id = p_user_id)
    RETURNING amount
  )
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_deleted, v_amount FROM deleted;

  IF v_deleted > 0 THEN
    UPDATE polla_editions
    SET bets_count = GREATEST(bets_count - v_deleted, 0),
        collected_amount = GREATEST(collected_amount - v_amount, 0),
        edited_at = NOW()
    WHERE polla_edition_id = p_edition_id;

    PERFORM polla_refresh_current_account_row(
      v_actor.polla_user_id,
      v_deducted_on,
      v_actor.polla_organization_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', v_deleted,
    'amount', v_amount,
    'deducted_on', v_deducted_on
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_unpaid_bets_summary(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_unpaid_bets_summary(UUID, UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_delete_unpaid_bets(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_delete_unpaid_bets(UUID, UUID, UUID) TO service_role;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS polla_delete_unpaid_bets(UUID, UUID, UUID);
-- DROP FUNCTION IF EXISTS polla_unpaid_bets_summary(UUID, UUID, UUID);
-- Los tickets que se borraron quedan borrados, como con `polla_delete_bet`.
