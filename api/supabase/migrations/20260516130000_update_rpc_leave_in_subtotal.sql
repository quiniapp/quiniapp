-- Add p_leave_in_subtotal param to update_current_account_recompute and calculate_current_account
-- When true: leave is deducted within stored subtotal and drag (total stays the same).
-- Math: subtotal = revenue - leave, drag = prev_drag + subtotal
-- This propagates the leave deduction to subsequent days via drag carry-over.

-- ============================================================
-- 1. update_current_account_recompute
-- ============================================================

DROP FUNCTION IF EXISTS update_current_account_recompute(UUID, JSONB, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS update_current_account_recompute(UUID, JSONB, BOOLEAN, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION update_current_account_recompute(
  p_current_account_id UUID,
  p_props JSONB,
  p_calculate_leave BOOLEAN,
  p_organization_id UUID,
  p_leave_in_subtotal BOOLEAN DEFAULT FALSE
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
    v_prev_drag_raw := (p_props->>'previous_drag')::NUMERIC;
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
        -- When leave_in_subtotal: store leave deducted within subtotal and adjust drag
        IF p_leave_in_subtotal THEN
          v_subtotal := v_revenue - v_leave;
          v_drag := v_prev_drag + v_subtotal;
        END IF;
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

-- ============================================================
-- 2. calculate_current_account
-- ============================================================

DROP FUNCTION IF EXISTS calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS calculate_current_account(TEXT, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS calculate_current_account(TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION calculate_current_account(
  p_date_text TEXT,
  p_calculate_leave BOOLEAN DEFAULT FALSE,
  p_liquidated BOOLEAN DEFAULT FALSE,
  p_organization_id UUID DEFAULT NULL,
  p_leave_in_subtotal BOOLEAN DEFAULT FALSE
)
RETURNS JSONB[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_date DATE := to_date(p_date_text, 'DD-MM-YYYY');
  result_array JSONB[];
BEGIN
  IF p_organization_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_organization_id::text || ':' || p_date_text));
  END IF;

  WITH
  daily_activity AS (
    SELECT
      t.user_id,
      COALESCE(SUM(t.total), 0) AS pass_raw,
      COALESCE(SUM(t.total_prize), 0) AS successes
    FROM tickets t
    WHERE t.date = v_date
      AND t.deleted_at IS NULL
      AND (p_organization_id IS NULL OR t.organization_id = p_organization_id)
    GROUP BY t.user_id
  ),
  previous_state AS (
    SELECT DISTINCT ON (ca.user_id)
      ca.user_id,
      ca.total AS previous_balance,
      ca.drag AS previous_drag_raw,
      ca.leave AS previous_leave,
      ca.bills AS previous_bills,
      ca.is_liquidated AS previous_is_liquidated
    FROM current_accounts ca
    WHERE ca.date < v_date
      AND (p_organization_id IS NULL OR ca.organization_id = p_organization_id)
    ORDER BY ca.user_id, ca.date DESC
  ),
  existing_day AS (
    SELECT
      ca.user_id,
      COALESCE(ca.claims, 0) AS claims,
      COALESCE(ca.collections, 0) AS collections,
      COALESCE(ca.paid, 0) AS paid,
      COALESCE(ca.leave, 0) AS leave,
      COALESCE(ca.previous_balance, 0) AS previous_balance_today,
      COALESCE(ca.previous_drag, 0) AS previous_drag_today
    FROM current_accounts ca
    WHERE ca.date = v_date
      AND (p_organization_id IS NULL OR ca.organization_id = p_organization_id)
  ),
  calculated_data AS (
    SELECT
      u.user_id,
      u.name AS user_name,
      u.number AS user_number,
      COALESCE(da.pass_raw, 0) AS pass_raw,
      COALESCE(da.successes, 0) AS successes,
      COALESCE(ed.claims, 0) AS claims,
      GREATEST(COALESCE(ed.claims, 0), 0) AS claims_pos,
      LEAST(COALESCE(ed.claims, 0), 0) AS claims_neg,
      COALESCE(ed.collections, 0) AS collections,
      COALESCE(ed.paid, 0) AS paid,
      COALESCE(ed.leave, 0) AS leave_manual,
      COALESCE(ed.previous_balance_today, ps.previous_balance, 0) AS prev_balance_chosen,
      COALESCE(u.fee, 0) / 100.0 AS fee_pct,
      COALESCE(u.fee_plus, 0) / 100.0 AS fee_plus_pct,
      CASE
        WHEN COALESCE(u.fee_plus, 0) <= 0 THEN 0
        WHEN COALESCE(ps.previous_is_liquidated, FALSE) = TRUE AND COALESCE(ps.previous_leave, 0) > 0 THEN 0
        ELSE COALESCE(ps.previous_drag_raw, 0)
      END AS prev_drag_eff_hist,
      CASE
        WHEN COALESCE(u.fee_plus, 0) <= 0 THEN 0
        ELSE COALESCE(
          ed.previous_drag_today,
          CASE
            WHEN COALESCE(ps.previous_is_liquidated, FALSE) = TRUE AND COALESCE(ps.previous_leave, 0) > 0 THEN 0
            ELSE COALESCE(ps.previous_drag_raw, 0)
          END,
          0
        )
      END AS prev_drag_eff_chosen
    FROM users u
    LEFT JOIN daily_activity da ON u.user_id = da.user_id
    LEFT JOIN previous_state ps ON u.user_id = ps.user_id
    LEFT JOIN existing_day ed ON u.user_id = ed.user_id
    WHERE u.user_type = 'CASHIER'
      AND u.deleted_at IS NULL
      AND (p_organization_id IS NULL OR u.organization_id = p_organization_id)
  ),
  final_data AS (
    SELECT
      cd.*,
      ((cd.pass_raw + GREATEST(cd.claims, 0))
        - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
        - cd.successes
        + LEAST(cd.claims, 0)) AS revenue,
      (cd.pass_raw + GREATEST(cd.claims, 0)) AS pass,
      ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2) AS cashier_commission,
      ((cd.pass_raw + GREATEST(cd.claims, 0))
       - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
       - cd.successes
       + LEAST(cd.claims, 0)) AS subtotal,
      COALESCE(ps.previous_bills, 0) AS bills,
      (cd.prev_balance_chosen
       + (cd.pass_raw + GREATEST(cd.claims, 0)
          - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
          - cd.successes
          + LEAST(cd.claims, 0))
       - cd.collections
       + cd.paid) AS total_pre_leave,
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        ELSE cd.prev_drag_eff_chosen
             + (cd.pass_raw + GREATEST(cd.claims, 0)
                - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
                - cd.successes
                + LEAST(cd.claims, 0))
      END AS drag_calc,
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave
          THEN CASE WHEN (cd.prev_drag_eff_chosen
                          + (cd.pass_raw + GREATEST(cd.claims, 0)
                             - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
                             - cd.successes
                             + LEAST(cd.claims, 0))) > 0
                    THEN ROUND((cd.prev_drag_eff_chosen
                       + (cd.pass_raw + GREATEST(cd.claims, 0)
                          - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
                          - cd.successes
                          + LEAST(cd.claims, 0))) * cd.fee_plus_pct, 2)
                    ELSE 0
               END
        ELSE cd.leave_manual
      END AS leave_calc
    FROM calculated_data cd
    LEFT JOIN previous_state ps ON ps.user_id = cd.user_id
  ),
  resolved AS (
    SELECT
      fd.*,
      CASE
        WHEN fd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave THEN fd.leave_calc
        ELSE COALESCE(fd.leave_manual, 0)
      END AS leave_effective,
      (fd.total_pre_leave
       - CASE
           WHEN fd.fee_plus_pct <= 0 THEN 0
           WHEN p_calculate_leave THEN fd.leave_calc
           ELSE COALESCE(fd.leave_manual, 0)
         END) AS total_final,
      CASE WHEN fd.fee_plus_pct <= 0 THEN 0 ELSE fd.prev_drag_eff_chosen END AS previous_drag_to_store,
      fd.prev_balance_chosen AS previous_balance_to_store,
      -- When leave_in_subtotal: store leave deducted within subtotal
      CASE
        WHEN fd.fee_plus_pct <= 0 THEN fd.subtotal
        WHEN p_leave_in_subtotal AND p_calculate_leave AND fd.leave_calc > 0
          THEN fd.subtotal - fd.leave_calc
        ELSE fd.subtotal
      END AS subtotal_to_store,
      -- Drag uses the adjusted subtotal when leave_in_subtotal
      CASE
        WHEN fd.fee_plus_pct <= 0 THEN 0
        WHEN p_leave_in_subtotal AND p_calculate_leave AND fd.leave_calc > 0
          THEN fd.prev_drag_eff_chosen + fd.subtotal - fd.leave_calc
        ELSE fd.prev_drag_eff_chosen + fd.subtotal
      END AS drag_to_store
    FROM final_data fd
  ),
  upserted_rows AS (
    INSERT INTO current_accounts (
      current_account_id,
      user_id, user_name, user_number,
      pass, successes, claims,
      subtotal, previous_balance, collections, paid,
      total, drag, leave, date,
      created_at, edited_at,
      cashier_commission, bills, revenue, previous_drag,
      is_liquidated, organization_id
    )
    SELECT
      gen_random_uuid(),
      r.user_id, r.user_name, r.user_number,
      r.pass, r.successes, r.claims,
      r.subtotal_to_store, r.previous_balance_to_store, r.collections, r.paid,
      r.total_final, r.drag_to_store,
      CASE WHEN p_calculate_leave THEN r.leave_calc ELSE COALESCE(r.leave_manual, 0) END,
      v_date,
      NOW(), NOW(),
      r.cashier_commission, r.bills, r.revenue, r.previous_drag_to_store,
      CASE WHEN p_liquidated THEN TRUE ELSE FALSE END,
      p_organization_id
    FROM resolved r
    ON CONFLICT (user_id, date) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      user_number = EXCLUDED.user_number,
      pass = EXCLUDED.pass,
      successes = EXCLUDED.successes,
      claims = current_accounts.claims,
      collections = current_accounts.collections,
      paid = current_accounts.paid,
      leave = CASE
                WHEN p_calculate_leave THEN EXCLUDED.leave
                ELSE current_accounts.leave
              END,
      subtotal = EXCLUDED.subtotal,
      previous_balance = current_accounts.previous_balance,
      total = EXCLUDED.total,
      drag = EXCLUDED.drag,
      edited_at = NOW(),
      cashier_commission = EXCLUDED.cashier_commission,
      bills = EXCLUDED.bills,
      revenue = EXCLUDED.revenue,
      previous_drag = current_accounts.previous_drag,
      is_liquidated = CASE
                        WHEN p_liquidated THEN TRUE
                        ELSE current_accounts.is_liquidated
                      END
    RETURNING TO_JSONB(current_accounts.*) AS json_row
  )
  SELECT COALESCE(array_agg(upserted_rows.json_row), '{}'::JSONB[])
  INTO result_array
  FROM upserted_rows;

  RETURN result_array;
END;
$$;
