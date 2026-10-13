-- Polla: el pasador borra jugadas hasta el cierre de carga.
--
-- Hasta ahora, sin force (pasador) solo se borraba una jugada cargada ese mismo
-- día. Ahora el pasador puede dar de baja lo suyo y lo de sus jugadores (por
-- ejemplo, una polla que no le pagaron) mientras la carga de la edición siga
-- abierta. Con la polla en juego ya no: `load_limit_date < start_date` (CHECK de
-- polla_editions) garantiza que para entonces la carga cerró.
--
-- Lo liquidado no cambia solo: si la cuenta del pasador ya se liquidó el día de
-- carga de la jugada o después, solo un admin (force) puede borrarla.

-- ============================================================
-- Baja de una jugada: sin force, con la carga abierta y sin liquidar
-- ============================================================

DROP FUNCTION IF EXISTS polla_delete_bet(UUID, UUID, BOOLEAN);

CREATE FUNCTION polla_delete_bet(
  p_bet_id UUID,
  p_actor_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bet polla_bets;
  v_edition polla_editions;
BEGIN
  SELECT * INTO v_bet
  FROM polla_bets
  WHERE polla_bet_id = p_bet_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_BET_NOT_FOUND';
  END IF;

  IF v_bet.winner THEN
    RAISE EXCEPTION 'POLLA_BET_ALREADY_WINNER';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = v_bet.polla_edition_id
  FOR UPDATE;

  IF NOT p_force THEN
    IF polla_load_closed(v_edition.load_limit_date, v_edition.load_limit_time) THEN
      RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM polla_current_accounts ca
      WHERE ca.polla_user_id = v_bet.cashier_polla_user_id
        AND ca.is_liquidated
        AND ca.date >= v_bet.load_date
    ) THEN
      RAISE EXCEPTION 'POLLA_BET_DELETE_LIQUIDATED';
    END IF;
  END IF;

  UPDATE polla_bets
  SET deleted_at = NOW(),
      deleted_by = p_actor_id
  WHERE polla_bet_id = p_bet_id;

  UPDATE polla_editions
  SET bets_count = GREATEST(bets_count - 1, 0),
      collected_amount = GREATEST(collected_amount - v_bet.amount, 0),
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id;

  PERFORM polla_refresh_current_account_row(
    v_bet.cashier_polla_user_id,
    v_bet.load_date,
    v_bet.polla_organization_id
  );

  RETURN jsonb_build_object('success', true, 'polla_bet_id', p_bet_id);
END;
$$;

REVOKE ALL ON FUNCTION polla_delete_bet(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_delete_bet(UUID, UUID, BOOLEAN) TO service_role;
