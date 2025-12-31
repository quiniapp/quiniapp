-- ============================================================================
-- Migración: Fix update_current_account_recompute para aceptar previous_balance y previous_drag
-- ============================================================================
-- Esta migración actualiza el stored procedure para que acepte los campos
-- previous_balance y previous_drag desde p_props en lugar de ignorarlos.
-- ============================================================================

DROP FUNCTION IF EXISTS update_current_account_recompute(UUID, JSONB, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION update_current_account_recompute(
  p_current_account_id UUID,
  p_props JSONB,
  p_calculate_leave BOOLEAN,
  p_organization_id UUID
)
RETURNS current_accounts
LANGUAGE plpgsql
AS $$
DECLARE
  cur current_accounts;
  v_user_id UUID;
  v_date DATE;
  row_count INTEGER;
  v_pass_raw NUMERIC := 0;
  v_successes NUMERIC := 0;
  v_fee_pct NUMERIC := 0;
  v_fee_plus_pct NUMERIC := 0;
  v_prev_total NUMERIC := 0;
  v_prev_drag_raw NUMERIC := 0;
  v_prev_leave NUMERIC := 0;
  v_prev_bills NUMERIC := 0;
  v_prev_drag NUMERIC := 0;
  eff_claims NUMERIC := 0;
  eff_collections NUMERIC := 0;
  eff_paid NUMERIC := 0;
  eff_bills NUMERIC := 0;
  claims_pos NUMERIC := 0;
  claims_neg NUMERIC := 0;
  v_pass NUMERIC := 0;
  v_comm NUMERIC := 0;
  v_subtotal NUMERIC := 0;
  v_revenue NUMERIC := 0;
  v_total NUMERIC := 0;
  v_drag NUMERIC := 0;
  v_leave NUMERIC := 0;
  has_claims BOOLEAN := p_props ? 'claims';
  has_collections BOOLEAN := p_props ? 'collections';
  has_paid BOOLEAN := p_props ? 'paid';
  has_bills BOOLEAN := p_props ? 'bills';
  has_previous_balance BOOLEAN := p_props ? 'previous_balance';
  has_previous_drag BOOLEAN := p_props ? 'previous_drag';
BEGIN
  -- 1) Fila actual (lock)
  SELECT * INTO cur
  FROM current_accounts
  WHERE current_account_id = p_current_account_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'current_account_id % no existe', p_current_account_id;
  END IF;

  v_user_id := cur.user_id;
  v_date := cur.date::date;

  -- 2) Tickets del día
  SELECT
    COALESCE(SUM(t.total), 0),
    COALESCE(SUM(t.total_prize), 0)
  INTO v_pass_raw, v_successes
  FROM tickets t
  WHERE t.user_id = v_user_id
    AND t.date = v_date
    AND t.deleted_at IS NULL
    AND t.organization_id = p_organization_id;

  -- 3) Fee y fee_plus del usuario
  SELECT
    COALESCE(u.fee, 0) / 100.0,
    COALESCE(u.fee_plus, 0) / 100.0
  INTO v_fee_pct, v_fee_plus_pct
  FROM users u
  WHERE u.user_id = v_user_id
    AND u.deleted_at IS NULL
    AND u.organization_id = p_organization_id;

  -- 4) Estado anterior (de la DB)
  SELECT
    COALESCE(ca.total, 0),
    COALESCE(ca.drag, 0),
    COALESCE(ca.leave, 0),
    COALESCE(ca.bills, 0)
  INTO
    v_prev_total,
    v_prev_drag_raw,
    v_prev_leave,
    v_prev_bills
  FROM current_accounts ca
  WHERE ca.user_id = v_user_id
    AND ca.date < v_date
    AND ca.organization_id = p_organization_id
  ORDER BY ca.date DESC
  LIMIT 1;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count = 0 THEN
    v_prev_total := 0;
    v_prev_drag_raw := 0;
    v_prev_leave := 0;
    v_prev_bills := 0;
  END IF;

  -- 4b) Override con valores del JSON si vienen
  IF has_previous_balance THEN
    v_prev_total := (p_props->>'previous_balance')::NUMERIC;
  END IF;

  IF has_previous_drag THEN
    -- Si viene previous_drag en el JSON, usarlo directamente
    v_prev_drag_raw := (p_props->>'previous_drag')::NUMERIC;
    -- También reseteamos v_prev_leave para que no interfiera con el cálculo
    v_prev_leave := 0;
  END IF;

  v_prev_drag := CASE
    WHEN v_prev_leave > 0 AND v_prev_drag_raw > 0 THEN 0
    ELSE v_prev_drag_raw
  END;

  -- 5) Manuales efectivos
  eff_claims := COALESCE((CASE WHEN has_claims THEN (p_props->>'claims')::NUMERIC END), cur.claims, 0);
  eff_collections := COALESCE((CASE WHEN has_collections THEN (p_props->>'collections')::NUMERIC END), cur.collections, 0);
  eff_paid := COALESCE((CASE WHEN has_paid THEN (p_props->>'paid')::NUMERIC END), cur.paid, 0);
  eff_bills := COALESCE((CASE WHEN has_bills THEN (p_props->>'bills')::NUMERIC END), v_prev_bills);

  -- 6) Reglas base del día
  claims_pos := GREATEST(eff_claims, 0);
  claims_neg := LEAST(eff_claims, 0);
  v_pass := v_pass_raw + claims_pos;
  v_comm := ROUND(v_pass * v_fee_pct, 2);
  v_subtotal := v_pass - v_comm - v_successes + claims_neg;
  v_revenue := v_subtotal;
  v_total := v_prev_total + v_revenue - eff_collections + eff_paid;

  -- 7) DRAG y LEAVE con condición de fee_plus
  IF v_fee_plus_pct > 0 THEN
    v_drag := v_prev_drag + v_revenue;
    IF p_calculate_leave THEN
      IF v_drag > 0 THEN
        v_leave := ROUND(v_drag * v_fee_plus_pct, 2);
        v_total := v_total - v_leave;
      ELSE
        v_leave := 0;
      END IF;
    ELSE
      v_leave := COALESCE(cur.leave, 0);
    END IF;
  ELSE
    v_prev_drag := 0;
    v_drag := 0;
    v_leave := 0;
  END IF;

  -- 8) Update y retorno
  UPDATE current_accounts ca
  SET
    claims = eff_claims,
    collections = eff_collections,
    paid = eff_paid,
    bills = eff_bills,
    pass = v_pass,
    successes = v_successes,
    cashier_commission = v_comm,
    subtotal = v_subtotal,
    revenue = v_revenue,
    previous_balance = v_prev_total,
    previous_drag = v_prev_drag,
    total = v_total,
    drag = v_drag,
    leave = v_leave,
    edited_at = NOW()
  WHERE ca.current_account_id = p_current_account_id
    AND ca.organization_id = p_organization_id
  RETURNING * INTO cur;

  RETURN cur;
END;
$$;
