-- R20: premio pagado / no pagado.
--
-- En Premios, el dueño, el capitalista y el superadmin tildan los premios que
-- ya transfirieron. Se guarda quién y cuándo. Una vez tildado no se destilda.
--
-- Sin CHECK contra `winner`: si una corrección de resultados anula a un
-- ganador que ya cobró, el reproceso no puede fallar por eso. La marca queda y
-- la pantalla de Premios solo lista ganadoras.

ALTER TABLE polla_bets
  ADD COLUMN prize_paid_at TIMESTAMPTZ,
  ADD COLUMN prize_paid_by UUID REFERENCES polla_users(polla_user_id);

COMMENT ON COLUMN polla_bets.prize_paid_at IS 'Cuándo se marcó el premio como pagado (R20). No se desmarca.';
COMMENT ON COLUMN polla_bets.prize_paid_by IS 'Quién marcó el premio como pagado.';

CREATE OR REPLACE FUNCTION polla_mark_prize_paid(p_actor_id UUID, p_bet_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor polla_users;
  v_bet polla_bets;
BEGIN
  SELECT * INTO v_actor
  FROM polla_users
  WHERE polla_user_id = p_actor_id
    AND deleted_at IS NULL
    AND disabled = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  IF v_actor.user_type NOT IN ('OWNER', 'CAPITALIST', 'SUPERADMIN') THEN
    RAISE EXCEPTION 'POLLA_PRIZE_PAY_FORBIDDEN';
  END IF;

  SELECT * INTO v_bet
  FROM polla_bets
  WHERE polla_bet_id = p_bet_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_bet.polla_organization_id <> v_actor.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_BET_NOT_FOUND';
  END IF;

  IF NOT v_bet.winner THEN
    RAISE EXCEPTION 'POLLA_PRIZE_NOT_WINNER';
  END IF;

  -- Una vez pagado queda fijo (quién y cuándo no cambian).
  IF v_bet.prize_paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'POLLA_PRIZE_ALREADY_PAID';
  END IF;

  UPDATE polla_bets
  SET prize_paid_at = NOW(),
      prize_paid_by = p_actor_id
  WHERE polla_bet_id = p_bet_id
  RETURNING * INTO v_bet;

  RETURN jsonb_build_object(
    'success', true,
    'polla_bet_id', v_bet.polla_bet_id,
    'prize_paid_at', v_bet.prize_paid_at,
    'prize_paid_by', v_bet.prize_paid_by
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_mark_prize_paid(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_mark_prize_paid(UUID, UUID) TO service_role;

-- ROLLBACK:
-- Se pierde qué premios estaban pagados: antes conviene exportarlos
-- (SELECT ticket_number, prize, prize_paid_at FROM polla_bets WHERE prize_paid_at IS NOT NULL).
-- DROP FUNCTION IF EXISTS polla_mark_prize_paid(UUID, UUID);
-- ALTER TABLE polla_bets DROP COLUMN IF EXISTS prize_paid_by, DROP COLUMN IF EXISTS prize_paid_at;
