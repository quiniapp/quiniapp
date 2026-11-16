-- Editar cobros y pagos del historial por fecha.
--
-- `polla_edit_current_account_payments` cambia los cobros y los pagos de un día
-- de un pasador (liquidado o no) y propaga la diferencia, en una sola
-- transacción:
-- * día editado: cobros y pagos nuevos, y `total + delta`;
-- * cada día siguiente del pasador: `previous_balance + delta` y `total + delta`.
-- `delta = (cobros viejos - cobros nuevos) + (pagos nuevos - pagos viejos)`.
--
-- Nada más cambia: pase, borradas, premios, reclamos, comisión, subtotal,
-- ganancia, arrastre, deje e `is_liquidated` quedan iguales. Cobros y pagos no
-- entran en el subtotal ni en el arrastre, y el deje sale del arrastre. Las
-- liquidaciones de grupos por fecha tampoco cambian (salen de los subtotales).
--
-- Errores:
-- * `POLLA_CURRENT_ACCOUNT_AMOUNT_INVALID`: un monto vacío, negativo, con más
--   de 2 decimales o que no entra en NUMERIC(12,2);
-- * `POLLA_CURRENT_ACCOUNT_NOT_FOUND`: el día no existe o es de otra organización.

DROP FUNCTION IF EXISTS polla_edit_current_account_payments(UUID, UUID, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION polla_edit_current_account_payments(
  p_organization_id UUID,
  p_current_account_id UUID,
  p_collections NUMERIC,
  p_paid NUMERIC
)
RETURNS polla_current_accounts
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row polla_current_accounts;
  v_delta NUMERIC;
BEGIN
  -- Las columnas son NUMERIC(12,2): un tercer decimal se redondearía distinto
  -- en los cobros y en el total. `BETWEEN` también deja afuera NaN e Infinity.
  IF p_collections IS NULL OR p_paid IS NULL
     OR NOT (p_collections BETWEEN 0 AND 9999999999.99)
     OR NOT (p_paid BETWEEN 0 AND 9999999999.99)
     OR p_collections <> round(p_collections, 2)
     OR p_paid <> round(p_paid, 2) THEN
    RAISE EXCEPTION 'POLLA_CURRENT_ACCOUNT_AMOUNT_INVALID';
  END IF;

  SELECT * INTO v_row
  FROM polla_current_accounts
  WHERE polla_current_account_id = p_current_account_id
    AND polla_organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_CURRENT_ACCOUNT_NOT_FOUND';
  END IF;

  -- Los días siguientes del pasador, bloqueados en orden de fecha.
  PERFORM 1
  FROM polla_current_accounts
  WHERE polla_user_id = v_row.polla_user_id
    AND polla_organization_id = p_organization_id
    AND date > v_row.date
  ORDER BY date
  FOR UPDATE;

  -- Más cobros bajan el saldo del pasador; más pagos lo suben.
  v_delta := (v_row.collections - p_collections) + (p_paid - v_row.paid);

  UPDATE polla_current_accounts
  SET collections = p_collections,
      paid = p_paid,
      total = total + v_delta,
      edited_at = NOW()
  WHERE polla_current_account_id = v_row.polla_current_account_id
  RETURNING * INTO v_row;

  -- Sin diferencia, los días siguientes quedan como estaban.
  IF v_delta <> 0 THEN
    UPDATE polla_current_accounts
    SET previous_balance = previous_balance + v_delta,
        total = total + v_delta,
        edited_at = NOW()
    WHERE polla_user_id = v_row.polla_user_id
      AND polla_organization_id = p_organization_id
      AND date > v_row.date;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION polla_edit_current_account_payments(UUID, UUID, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edit_current_account_payments(UUID, UUID, NUMERIC, NUMERIC) TO service_role;

-- ROLLBACK:
-- DROP FUNCTION polla_edit_current_account_payments(UUID, UUID, NUMERIC, NUMERIC);
