-- "Generar liquidación" de una edición (Cuenta corriente → Pasadores).
--
-- Como el modal de QuiniApp, pero por edición: en una tabla se tilda a quién
-- liquidar y se escribe lo que se suma hoy en reclamos, cobros y pagos. Todo
-- en una transacción:
--
-- 1. Por cada pasador elegido se cargan sus movimientos nuevos (con fecha de
--    hoy): un cobro y un pago si son mayores a 0, un reclamo si no es 0.
-- 2. Se liquidan con `polla_liquidate_edition_accounts` (la foto incluye los
--    movimientos recién cargados).
-- 3. La edición queda marcada como liquidada. Si ya lo estaba, conserva quién
--    y cuándo la marcó primero.
--
-- Sin origen elegido (`p_ticket_source` NULL), si las jugadas de algún elegido
-- cambiaron desde su liquidación anterior, devuelve `DIFFERENCES` (igual que
-- `polla_liquidate_edition_accounts`) sin escribir nada, ni los movimientos.
-- Los cobros y pagos que se cargan después (tocando la fila) se suman solos:
-- los movimientos siempre son en vivo.

CREATE FUNCTION polla_generate_edition_liquidation(
  p_organization_id UUID,
  p_edition_id UUID,
  p_actor_id UUID,
  p_entries JSONB,
  p_ticket_source TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_ids UUID[];
  v_missing_user BOOLEAN;
  v_duplicated BOOLEAN;
  v_negative BOOLEAN;
  v_result JSONB;
  v_differences JSONB;
BEGIN
  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'POLLA_EDITION_LIQUIDATION_EMPTY';
  END IF;

  SELECT array_agg(e.polla_user_id),
         bool_or(e.polla_user_id IS NULL),
         count(DISTINCT e.polla_user_id) <> count(*),
         -- Cobro y pago, siempre positivos (0 = no se carga); el reclamo, con signo.
         bool_or(COALESCE(e.collection, 0) < 0 OR COALESCE(e.payment, 0) < 0)
  INTO v_user_ids, v_missing_user, v_duplicated, v_negative
  FROM jsonb_to_recordset(p_entries) AS e(polla_user_id UUID, collection NUMERIC, payment NUMERIC, claim NUMERIC);

  IF v_missing_user THEN
    RAISE EXCEPTION 'POLLA_ACCOUNT_USER_NOT_CASHIER';
  END IF;

  IF v_duplicated THEN
    RAISE EXCEPTION 'POLLA_EDITION_LIQUIDATION_DUPLICATE';
  END IF;

  IF v_negative THEN
    RAISE EXCEPTION 'POLLA_EDITION_LIQUIDATION_AMOUNT_INVALID';
  END IF;

  -- Bloque con su propio punto de rescate: si la liquidación avisa diferencias,
  -- se deshacen los movimientos recién cargados y se devuelven las diferencias.
  BEGIN
    INSERT INTO polla_edition_account_movements (
      polla_organization_id, polla_edition_id, polla_user_id, type, amount, date, created_by
    )
    SELECT p_organization_id, p_edition_id, e.polla_user_id, x.type::polla_account_movement_type_enum,
           x.amount, polla_today(), p_actor_id
    FROM jsonb_to_recordset(p_entries) AS e(polla_user_id UUID, collection NUMERIC, payment NUMERIC, claim NUMERIC)
    CROSS JOIN LATERAL (VALUES
      ('CLAIM', COALESCE(e.claim, 0)),
      ('COLLECTION', COALESCE(e.collection, 0)),
      ('PAYMENT', COALESCE(e.payment, 0))
    ) AS x(type, amount)
    WHERE x.amount <> 0;

    v_result := polla_liquidate_edition_accounts(
      p_organization_id, p_edition_id, v_user_ids, p_actor_id, p_ticket_source
    );

    IF v_result->>'status' = 'DIFFERENCES' THEN
      v_differences := v_result->'differences';
      RAISE EXCEPTION 'POLLA_EDITION_LIQUIDATION_DIFFERENCES';
    END IF;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'POLLA_EDITION_LIQUIDATION_DIFFERENCES' THEN
      RETURN jsonb_build_object('status', 'DIFFERENCES', 'differences', v_differences);
    END IF;
    RAISE;
  END;

  -- `polla_liquidate_edition_accounts` ya validó la edición (organización,
  -- cuenta por edición y carga cortada).
  UPDATE polla_editions
  SET liquidated_at = NOW(),
      liquidated_by = p_actor_id
  WHERE polla_edition_id = p_edition_id
    AND liquidated_at IS NULL;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION polla_generate_edition_liquidation(UUID, UUID, UUID, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_generate_edition_liquidation(UUID, UUID, UUID, JSONB, TEXT) TO service_role;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS polla_generate_edition_liquidation(UUID, UUID, UUID, JSONB, TEXT);
