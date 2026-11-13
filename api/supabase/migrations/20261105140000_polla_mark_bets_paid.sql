-- R13: tickets fiados (Debe). Marcarlos como pagados.
--
-- `polla_mark_bets_paid` pasa jugadas de Debe a Pagado, en efectivo, y guarda
-- quién las cobró y cuándo. Solo Debe → Pagado: una pagada no vuelve a Debe
-- (las que ya estaban pagadas no se tocan). Dos formas:
--   - por ids (`p_bet_ids`): esos tickets;
--   - por jugador (`p_edition_id` + `p_user_id`): todos sus impagos en la edición.
--
-- Quién: el pasador, lo imputado a él (lo suyo y lo de sus jugadores); el
-- admin, lo de su grupo; el Súper y superadmin+, toda la organización. El
-- jugador no.

-- Si el actor cobra esa jugada (misma organización y su alcance).
CREATE OR REPLACE FUNCTION polla_bet_in_payment_scope(p_actor polla_users, p_bet polla_bets)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_bet.polla_organization_id = p_actor.polla_organization_id
    AND CASE
      WHEN p_actor.user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN', 'ASSISTANT') THEN TRUE
      WHEN p_actor.user_type = 'ADMIN' THEN
        p_actor.polla_group_id IS NOT NULL
        AND p_bet.polla_group_id IS NOT DISTINCT FROM p_actor.polla_group_id
      WHEN p_actor.user_type = 'CASHIER' THEN
        p_bet.cashier_polla_user_id = p_actor.polla_user_id
      ELSE FALSE
    END;
$$;

CREATE OR REPLACE FUNCTION polla_mark_bets_paid(
  p_actor_id UUID,
  p_bet_ids UUID[] DEFAULT NULL,
  p_edition_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor polla_users;
  v_ids UUID[];
  v_found INTEGER;
  v_in_scope INTEGER;
  v_updated INTEGER;
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

  IF v_actor.user_type = 'PLAYER' THEN
    RAISE EXCEPTION 'POLLA_PAYMENT_FORBIDDEN';
  END IF;

  IF p_bet_ids IS NULL AND (p_edition_id IS NULL OR p_user_id IS NULL) THEN
    RAISE EXCEPTION 'POLLA_PAYMENT_TARGET_REQUIRED';
  END IF;

  -- Las jugadas pedidas, vigentes, bloqueadas hasta terminar.
  IF p_bet_ids IS NOT NULL THEN
    v_ids := ARRAY(
      SELECT b.polla_bet_id
      FROM polla_bets b
      WHERE b.polla_bet_id = ANY (p_bet_ids)
        AND b.deleted_at IS NULL
      FOR UPDATE
    );
  ELSE
    v_ids := ARRAY(
      SELECT b.polla_bet_id
      FROM polla_bets b
      WHERE b.polla_edition_id = p_edition_id
        AND b.polla_user_id = p_user_id
        AND b.deleted_at IS NULL
      FOR UPDATE
    );
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE polla_bet_in_payment_scope(v_actor, b))
  INTO v_found, v_in_scope
  FROM polla_bets b
  WHERE b.polla_bet_id = ANY (v_ids);

  -- Todas tienen que ser del alcance; por ids, además, tienen que existir. Si
  -- falla una, no se marca ninguna.
  IF v_in_scope <> v_found
     OR (p_bet_ids IS NOT NULL
         AND v_found <> cardinality(ARRAY(SELECT DISTINCT unnest(p_bet_ids)))) THEN
    RAISE EXCEPTION 'POLLA_BET_OUT_OF_SCOPE';
  END IF;

  WITH paid AS (
    UPDATE polla_bets b
    SET payment_status = 'PAID',
        payment_method = 'CASH',
        paid_at = NOW(),
        paid_by = p_actor_id
    WHERE b.polla_bet_id = ANY (v_ids)
      AND b.payment_status = 'OWED'
    RETURNING b.amount
  )
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_updated, v_amount FROM paid;

  RETURN jsonb_build_object('success', true, 'updated', v_updated, 'amount', v_amount);
END;
$$;

REVOKE ALL ON FUNCTION polla_bet_in_payment_scope(polla_users, polla_bets) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_bet_in_payment_scope(polla_users, polla_bets) TO service_role;
REVOKE ALL ON FUNCTION polla_mark_bets_paid(UUID, UUID[], UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_mark_bets_paid(UUID, UUID[], UUID, UUID) TO service_role;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS polla_mark_bets_paid(UUID, UUID[], UUID, UUID);
-- DROP FUNCTION IF EXISTS polla_bet_in_payment_scope(polla_users, polla_bets);
-- Las jugadas que se marcaron como pagadas quedan pagadas (el estado de pago
-- es de la migración de R04).
