-- Polla: borrar una edición anula sus jugadas.
--
-- Hasta acá el borrado de una edición solo le ponía deleted_at a la edición:
-- sus jugadas seguían vivas y la cuenta corriente, que suma las jugadas del día
-- por pasador, las seguía contando en el pase. En develop un pasador mostraba
-- $22.000 de pase con una sola jugada de $2.000 en la única edición vigente:
-- las otras 10 eran de dos ediciones de prueba borradas.
--
-- * polla_delete_edition borra la edición, anula sus jugadas y recalcula la
--   cuenta corriente de los pasadores y días afectados. No borra una edición
--   con ganadores: sus premios ya entraron en la liquidación.
-- * Las jugadas que quedaron vivas en ediciones ya borradas se anulan con la
--   fecha de borrado de su edición y se recalculan sus cuentas.

-- ============================================================
-- 1. Borrado de una edición
-- ============================================================

DROP FUNCTION IF EXISTS polla_delete_edition(UUID, UUID);

CREATE FUNCTION polla_delete_edition(
  p_edition_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
  v_voided INTEGER;
  v_account RECORD;
BEGIN
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1 FROM polla_bets
    WHERE polla_edition_id = p_edition_id
      AND deleted_at IS NULL
      AND winner
  ) THEN
    RAISE EXCEPTION 'POLLA_EDITION_HAS_WINNERS';
  END IF;

  UPDATE polla_editions
  SET deleted_at = NOW(),
      edited_at = NOW()
  WHERE polla_edition_id = p_edition_id;

  SELECT COUNT(*) INTO v_voided
  FROM polla_bets
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL;

  -- Se anulan las jugadas y se recalcula cada pasador y día afectado.
  FOR v_account IN
    WITH voided AS (
      UPDATE polla_bets
      SET deleted_at = NOW(),
          deleted_by = p_actor_id
      WHERE polla_edition_id = p_edition_id
        AND deleted_at IS NULL
      RETURNING cashier_polla_user_id, load_date, polla_organization_id
    )
    SELECT DISTINCT cashier_polla_user_id, load_date, polla_organization_id
    FROM voided
    ORDER BY load_date
  LOOP
    PERFORM polla_refresh_current_account_row(
      v_account.cashier_polla_user_id,
      v_account.load_date,
      v_account.polla_organization_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'polla_edition_id', p_edition_id,
    'voided_bets', v_voided
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_delete_edition(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_delete_edition(UUID, UUID) TO service_role;

-- ============================================================
-- 2. Jugadas que quedaron vivas en ediciones ya borradas
-- ============================================================

DO $$
DECLARE
  v_account RECORD;
BEGIN
  FOR v_account IN
    WITH voided AS (
      UPDATE polla_bets b
      SET deleted_at = e.deleted_at
      FROM polla_editions e
      WHERE e.polla_edition_id = b.polla_edition_id
        AND e.deleted_at IS NOT NULL
        AND b.deleted_at IS NULL
        AND NOT b.winner
      RETURNING b.cashier_polla_user_id, b.load_date, b.polla_organization_id
    )
    SELECT DISTINCT cashier_polla_user_id, load_date, polla_organization_id
    FROM voided
    ORDER BY load_date
  LOOP
    PERFORM polla_refresh_current_account_row(
      v_account.cashier_polla_user_id,
      v_account.load_date,
      v_account.polla_organization_id
    );
  END LOOP;
END;
$$;
