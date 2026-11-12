-- R18 (arreglo): un día ya liquidado no vuelve a sumar premios al
-- recalcularse.
--
-- La versión de 20261106090000 sacaba los premios del período abierto, pero un
-- día hasta la última liquidación los volvía a calcular desde las jugadas
-- ganadoras. Así, si se reprocesaba un resultado de un día que se liquidó
-- después de R18 (con premios en 0), el recálculo metía el premio en esa fila
-- liquidada y le cambiaba el subtotal y el saldo.
--
-- Ahora un día liquidado conserva el `successes` que tiene guardado: los
-- liquidados antes de R18, con su premio; los de después, en 0. Lo liquidado
-- no se toca. Las demás cuentas son las mismas.

DROP FUNCTION IF EXISTS polla_calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS polla_update_current_account_recompute(UUID, JSONB, BOOLEAN, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION polla_calculate_current_account(p_date_text text, p_calculate_leave boolean DEFAULT false, p_liquidated boolean DEFAULT false, p_organization_id uuid DEFAULT NULL::uuid, p_leave_in_subtotal boolean DEFAULT false)
 RETURNS jsonb[]
 LANGUAGE plpgsql
 SET search_path TO 'public'
 SET statement_timeout TO '300000'
AS $function$
DECLARE
  v_date DATE := to_date(p_date_text, 'DD-MM-YYYY');
  result_array JSONB[];
BEGIN
  IF p_organization_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('polla:' || p_organization_id::text || ':' || p_date_text));
  END IF;

  WITH
  daily_activity AS (
    SELECT
      a.polla_user_id,
      SUM(a.bets_pass) AS bets_pass,
      SUM(a.deleted_pass) AS deleted_pass,
      SUM(a.successes) AS successes
    FROM (
      -- Cargadas el día y activas.
      SELECT b.cashier_polla_user_id AS polla_user_id,
             b.amount AS bets_pass,
             0::NUMERIC AS deleted_pass,
             0::NUMERIC AS successes
      FROM polla_bets b
      WHERE b.load_date = v_date
        AND b.deleted_at IS NULL
        AND (p_organization_id IS NULL OR b.polla_organization_id = p_organization_id)
      UNION ALL
      -- Cargadas el día y borradas después: siguen en el pase de su día.
      SELECT b.cashier_polla_user_id, b.amount, 0, 0
      FROM polla_bets b
      WHERE b.deducted_on IS NOT NULL
        AND b.load_date = v_date
        AND (p_organization_id IS NULL OR b.polla_organization_id = p_organization_id)
      UNION ALL
      -- Borradas que se descuentan el día.
      SELECT b.cashier_polla_user_id, 0, b.amount, 0
      FROM polla_bets b
      WHERE b.deducted_on = v_date
        AND (p_organization_id IS NULL OR b.polla_organization_id = p_organization_id)
    ) a
    GROUP BY a.polla_user_id
  ),
  -- R18: los premios no van en la cuenta corriente. Un día hasta la última
  -- liquidación del pasador conserva los premios que se le liquidaron (los de
  -- antes de R18; después de R18 son 0), aunque se recalcule: no se vuelven a
  -- sacar de las jugadas.
  last_liquidation AS (
    SELECT ca.polla_user_id, MAX(ca.date) AS liquidated_until
    FROM polla_current_accounts ca
    WHERE ca.is_liquidated
      AND (p_organization_id IS NULL OR ca.polla_organization_id = p_organization_id)
    GROUP BY ca.polla_user_id
  ),
  previous_state AS (
    SELECT DISTINCT ON (ca.polla_user_id)
      ca.polla_user_id,
      ca.total AS previous_balance,
      ca.drag AS previous_drag_raw,
      ca.leave AS previous_leave,
      ca.bills AS previous_bills,
      ca.is_liquidated AS previous_is_liquidated
    FROM polla_current_accounts ca
    WHERE ca.date < v_date
      AND (p_organization_id IS NULL OR ca.polla_organization_id = p_organization_id)
    ORDER BY ca.polla_user_id, ca.date DESC
  ),
  existing_day AS (
    SELECT
      ca.polla_user_id,
      COALESCE(ca.claims, 0) AS claims,
      COALESCE(ca.collections, 0) AS collections,
      COALESCE(ca.paid, 0) AS paid,
      COALESCE(ca.leave, 0) AS leave,
      COALESCE(ca.successes, 0) AS successes_today,
      COALESCE(ca.previous_balance, 0) AS previous_balance_today,
      COALESCE(ca.previous_drag, 0) AS previous_drag_today
    FROM polla_current_accounts ca
    WHERE ca.date = v_date
      AND (p_organization_id IS NULL OR ca.polla_organization_id = p_organization_id)
  ),
  calculated_data AS (
    SELECT
      u.polla_user_id,
      u.name AS user_name,
      u.number AS user_number,
      u.polla_organization_id,
      u.polla_group_id,
      COALESCE(da.bets_pass, 0) AS bets_pass,
      COALESCE(da.deleted_pass, 0) AS deleted_pass,
      COALESCE(da.bets_pass, 0) - COALESCE(da.deleted_pass, 0) AS pass_raw,
      CASE
        WHEN v_date <= ll.liquidated_until THEN COALESCE(ed.successes_today, 0)
        ELSE 0
      END AS successes,
      COALESCE(ed.claims, 0) AS claims,
      COALESCE(ed.collections, 0) AS collections,
      COALESCE(ed.paid, 0) AS paid,
      COALESCE(ed.leave, 0) AS leave_manual,
      COALESCE(ed.previous_balance_today, ps.previous_balance, 0) AS prev_balance_chosen,
      COALESCE(u.fee, 0) / 100.0 AS fee_pct,
      COALESCE(u.fee_plus, 0) / 100.0 AS fee_plus_pct,
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
      END AS prev_drag_eff_chosen,
      COALESCE(ps.previous_bills, 0) AS bills
    FROM polla_users u
    LEFT JOIN daily_activity da ON u.polla_user_id = da.polla_user_id
    LEFT JOIN previous_state ps ON u.polla_user_id = ps.polla_user_id
    LEFT JOIN existing_day ed ON u.polla_user_id = ed.polla_user_id
    LEFT JOIN last_liquidation ll ON u.polla_user_id = ll.polla_user_id
    WHERE u.user_type = 'CASHIER'
      AND u.deleted_at IS NULL
      AND (p_organization_id IS NULL OR u.polla_organization_id = p_organization_id)
  ),
  final_data AS (
    SELECT
      cd.*,
      (cd.pass_raw + GREATEST(cd.claims, 0)) AS pass,
      ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2) AS cashier_commission,
      ((cd.pass_raw + GREATEST(cd.claims, 0))
        - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
        - cd.successes
        + LEAST(cd.claims, 0)) AS revenue
    FROM calculated_data cd
  ),
  resolved AS (
    SELECT
      fd.*,
      fd.revenue AS subtotal,
      CASE WHEN fd.fee_plus_pct <= 0 THEN 0 ELSE fd.prev_drag_eff_chosen + fd.revenue END AS drag_calc,
      CASE
        WHEN fd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave THEN
          CASE
            WHEN (fd.prev_drag_eff_chosen + fd.revenue) > 0
              THEN ROUND((fd.prev_drag_eff_chosen + fd.revenue) * fd.fee_plus_pct, 2)
            ELSE 0
          END
        ELSE COALESCE(fd.leave_manual, 0)
      END AS leave_effective
    FROM final_data fd
  ),
  stored AS (
    SELECT
      r.*,
      CASE
        WHEN r.fee_plus_pct <= 0 THEN r.subtotal
        WHEN p_leave_in_subtotal AND p_calculate_leave AND r.leave_effective > 0
          THEN r.subtotal - r.leave_effective
        ELSE r.subtotal
      END AS subtotal_to_store,
      (r.prev_balance_chosen + r.revenue - r.collections + r.paid - r.leave_effective) AS total_final,
      CASE WHEN r.fee_plus_pct <= 0 THEN 0 ELSE r.prev_drag_eff_chosen END AS previous_drag_to_store
    FROM resolved r
  ),
  upserted_rows AS (
    INSERT INTO polla_current_accounts (
      polla_current_account_id,
      polla_user_id, user_name, user_number,
      polla_organization_id, polla_group_id,
      bets_pass, deleted_pass,
      pass, successes, claims,
      subtotal, previous_balance, collections, paid,
      total, drag, leave, date,
      created_at, edited_at,
      cashier_commission, bills, revenue, previous_drag,
      is_liquidated
    )
    SELECT
      gen_random_uuid(),
      s.polla_user_id, s.user_name, s.user_number,
      s.polla_organization_id, s.polla_group_id,
      s.bets_pass, s.deleted_pass,
      s.pass, s.successes, s.claims,
      s.subtotal_to_store, s.prev_balance_chosen, s.collections, s.paid,
      s.total_final, s.drag_calc, s.leave_effective, v_date,
      NOW(), NOW(),
      s.cashier_commission, s.bills, s.revenue, s.previous_drag_to_store,
      CASE WHEN p_liquidated THEN TRUE ELSE FALSE END
    FROM stored s
    ON CONFLICT (polla_user_id, date) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      user_number = EXCLUDED.user_number,
      polla_group_id = EXCLUDED.polla_group_id,
      bets_pass = EXCLUDED.bets_pass,
      deleted_pass = EXCLUDED.deleted_pass,
      pass = EXCLUDED.pass,
      successes = EXCLUDED.successes,
      claims = polla_current_accounts.claims,
      collections = polla_current_accounts.collections,
      paid = polla_current_accounts.paid,
      leave = CASE
                WHEN p_calculate_leave THEN EXCLUDED.leave
                ELSE polla_current_accounts.leave
              END,
      subtotal = EXCLUDED.subtotal,
      previous_balance = polla_current_accounts.previous_balance,
      total = EXCLUDED.total,
      drag = EXCLUDED.drag,
      edited_at = NOW(),
      cashier_commission = EXCLUDED.cashier_commission,
      bills = EXCLUDED.bills,
      revenue = EXCLUDED.revenue,
      previous_drag = polla_current_accounts.previous_drag,
      is_liquidated = CASE
                        WHEN p_liquidated THEN TRUE
                        ELSE polla_current_accounts.is_liquidated
                      END
    RETURNING TO_JSONB(polla_current_accounts.*) AS json_row
  )
  SELECT COALESCE(array_agg(upserted_rows.json_row), '{}'::JSONB[])
  INTO result_array
  FROM upserted_rows;

  RETURN result_array;
END;
$function$
;

CREATE OR REPLACE FUNCTION polla_update_current_account_recompute(p_polla_current_account_id uuid, p_props jsonb, p_calculate_leave boolean, p_organization_id uuid, p_leave_in_subtotal boolean DEFAULT false)
 RETURNS polla_current_accounts
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  cur polla_current_accounts;
  v_user_id UUID;
  v_date DATE;
  row_count INTEGER;
  v_bets_pass NUMERIC := 0;
  v_deleted_pass NUMERIC := 0;
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
  SELECT * INTO cur
  FROM polla_current_accounts
  WHERE polla_current_account_id = p_polla_current_account_id
    AND polla_organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_CURRENT_ACCOUNT_NOT_FOUND';
  END IF;

  v_user_id := cur.polla_user_id;
  v_date := cur.date;

  -- Pase de jugadas: lo cargado el día, aunque se haya borrado después.
  -- Borradas: lo que se descuenta el día.
  SELECT
    COALESCE(SUM(b.amount) FILTER (
      WHERE b.load_date = v_date AND (b.deleted_at IS NULL OR b.deducted_on IS NOT NULL)
    ), 0),
    COALESCE(SUM(b.amount) FILTER (WHERE b.deducted_on = v_date), 0)
  INTO v_bets_pass, v_deleted_pass
  FROM polla_bets b
  WHERE b.cashier_polla_user_id = v_user_id
    AND b.polla_organization_id = p_organization_id
    AND (b.load_date = v_date OR b.deducted_on = v_date);

  -- R18: los premios no van en la cuenta corriente (están en Premios). Un día
  -- ya liquidado conserva los que se le liquidaron (los de antes de R18).
  v_successes := COALESCE(cur.successes, 0);
  IF v_date > COALESCE(
    (
      SELECT MAX(ca.date)
      FROM polla_current_accounts ca
      WHERE ca.polla_user_id = v_user_id
        AND ca.is_liquidated
    ),
    '-infinity'::DATE
  ) THEN
    v_successes := 0;
  END IF;

  v_pass_raw := v_bets_pass - v_deleted_pass;

  SELECT
    COALESCE(u.fee, 0) / 100.0,
    COALESCE(u.fee_plus, 0) / 100.0
  INTO v_fee_pct, v_fee_plus_pct
  FROM polla_users u
  WHERE u.polla_user_id = v_user_id
    AND u.deleted_at IS NULL
    AND u.polla_organization_id = p_organization_id;

  SELECT
    COALESCE(ca.total, 0),
    COALESCE(ca.drag, 0),
    COALESCE(ca.leave, 0),
    COALESCE(ca.bills, 0)
  INTO v_prev_total, v_prev_drag_raw, v_prev_leave, v_prev_bills
  FROM polla_current_accounts ca
  WHERE ca.polla_user_id = v_user_id
    AND ca.date < v_date
    AND ca.polla_organization_id = p_organization_id
  ORDER BY ca.date DESC
  LIMIT 1;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count = 0 THEN
    v_prev_total := 0;
    v_prev_drag_raw := 0;
    v_prev_leave := 0;
    v_prev_bills := 0;
  END IF;

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

  eff_claims := COALESCE((CASE WHEN has_claims THEN (p_props->>'claims')::NUMERIC END), cur.claims, 0);
  eff_collections := COALESCE((CASE WHEN has_collections THEN (p_props->>'collections')::NUMERIC END), cur.collections, 0);
  eff_paid := COALESCE((CASE WHEN has_paid THEN (p_props->>'paid')::NUMERIC END), cur.paid, 0);
  eff_bills := COALESCE((CASE WHEN has_bills THEN (p_props->>'bills')::NUMERIC END), v_prev_bills);

  claims_pos := GREATEST(eff_claims, 0);
  claims_neg := LEAST(eff_claims, 0);
  v_pass := v_pass_raw + claims_pos;
  v_comm := ROUND(v_pass * v_fee_pct, 2);
  v_subtotal := v_pass - v_comm - v_successes + claims_neg;
  v_revenue := v_subtotal;
  v_total := v_prev_total + v_revenue - eff_collections + eff_paid;

  IF v_fee_plus_pct > 0 THEN
    v_drag := v_prev_drag + v_revenue;
    IF p_calculate_leave THEN
      IF v_drag > 0 THEN
        v_leave := ROUND(v_drag * v_fee_plus_pct, 2);
        v_total := v_total - v_leave;
        IF p_leave_in_subtotal THEN
          v_subtotal := v_revenue - v_leave;
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

  UPDATE polla_current_accounts ca
  SET
    claims = eff_claims,
    collections = eff_collections,
    paid = eff_paid,
    bills = eff_bills,
    bets_pass = v_bets_pass,
    deleted_pass = v_deleted_pass,
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
  WHERE ca.polla_current_account_id = p_polla_current_account_id
    AND ca.polla_organization_id = p_organization_id
  RETURNING * INTO cur;

  RETURN cur;
END;
$function$
;

REVOKE ALL ON FUNCTION polla_calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID, BOOLEAN) TO service_role;
REVOKE ALL ON FUNCTION polla_update_current_account_recompute(UUID, JSONB, BOOLEAN, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_update_current_account_recompute(UUID, JSONB, BOOLEAN, UUID, BOOLEAN) TO service_role;

-- ROLLBACK:
-- Volver a crear `polla_calculate_current_account` y
-- `polla_update_current_account_recompute` con las definiciones de
-- 20261106090000_polla_prizes_out_of_account.sql.
