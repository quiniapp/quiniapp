DROP FUNCTION IF EXISTS calculate_current_account (TEXT, BOOLEAN, BOOLEAN);

DROP FUNCTION IF EXISTS calculate_current_account (TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION calculate_current_account (
    p_date_text TEXT,
    p_calculate_leave BOOLEAN DEFAULT FALSE,
    p_liquidated BOOLEAN DEFAULT FALSE
) RETURNS JSONB[] LANGUAGE plpgsql AS $$
DECLARE
  v_date DATE := to_date(p_date_text, 'DD-MM-YYYY');
  result_array JSONB[];
BEGIN
  WITH
  -- 1) Actividad del día (tickets)
  daily_activity AS (
    SELECT
      t.user_id,
      COALESCE(SUM(t.total), 0)       AS pass_raw,
      COALESCE(SUM(t.total_prize), 0) AS successes
    FROM tickets t
    WHERE t.date = v_date AND t.deleted_at IS NULL
    GROUP BY t.user_id
  ),

  -- 2) Último estado anterior (< v_date)
  previous_state AS (
    SELECT DISTINCT ON (ca.user_id)
      ca.user_id,
      ca.total AS previous_balance,
      ca.drag  AS previous_drag_raw,
      ca.leave AS previous_leave,
      ca.bills AS previous_bills
    FROM current_accounts ca
    WHERE ca.date < v_date
    ORDER BY ca.user_id, ca.date DESC
  ),

  -- 3) Día existente (si ya hay fila)
  existing_day AS (
    SELECT
      ca.user_id,
      COALESCE(ca.claims, 0)           AS claims,
      COALESCE(ca.collections, 0)      AS collections,
      COALESCE(ca.paid, 0)             AS paid,
      COALESCE(ca.leave, 0)            AS leave,
      COALESCE(ca.previous_balance, 0) AS previous_balance_today,
      COALESCE(ca.previous_drag, 0)    AS previous_drag_today
    FROM current_accounts ca
    WHERE ca.date = v_date
  ),

  -- 4) Datos base con prioridades de previous_* y manuales del día
  calculated_data AS (
    SELECT
      u.user_id,
      u.name   AS user_name,
      u.number AS user_number,

      COALESCE(da.pass_raw, 0)    AS pass_raw,
      COALESCE(da.successes, 0)   AS successes,

      COALESCE(ed.claims, 0)      AS claims,
      GREATEST(COALESCE(ed.claims, 0), 0) AS claims_pos,
      LEAST(COALESCE(ed.claims, 0), 0)    AS claims_neg,

      COALESCE(ed.collections, 0) AS collections,
      COALESCE(ed.paid, 0)        AS paid,

      -- leave existente del día (si hay), lo propagamos como "manual"
      COALESCE(ed.leave, 0)       AS leave_manual,

      -- previous_* elegidos
      COALESCE(ed.previous_balance_today, ps.previous_balance, 0) AS prev_balance_chosen,

      -- fee y fee_plus
      COALESCE(u.fee, 0) / 100.0      AS fee_pct,
      COALESCE(u.fee_plus, 0) / 100.0 AS fee_plus_pct,

      -- drag histórico efectivo
      -- FIX: Reset drag if previous day had leave > 0 (end of month liquidation)
     CASE
  WHEN COALESCE(u.fee_plus, 0) <= 0 THEN 0
  WHEN COALESCE(ps.previous_leave, 0) > 0
   AND COALESCE(ps.previous_drag_raw, 0) > 0 THEN 0
  ELSE COALESCE(ps.previous_drag_raw, 0)
END AS prev_drag_eff_hist,

      -- previous_drag efectivo elegido
      -- FIX: Reset drag if previous day had leave > 0 (end of month liquidation)
     CASE
  WHEN COALESCE(u.fee_plus, 0) <= 0 THEN 0
  ELSE COALESCE(
         ed.previous_drag_today,
         CASE
           WHEN COALESCE(ps.previous_leave, 0) > 0
            AND COALESCE(ps.previous_drag_raw, 0) > 0 THEN 0
           ELSE COALESCE(ps.previous_drag_raw, 0)
         END,
         0
       )
END AS prev_drag_eff_chosen
    FROM users u
    LEFT JOIN daily_activity da ON u.user_id = da.user_id
    LEFT JOIN previous_state ps ON u.user_id = ps.user_id
    LEFT JOIN existing_day ed   ON u.user_id = ed.user_id
    WHERE u.user_type = 'CASHIER' AND u.deleted_at IS NULL
  ),

  -- 5) Totales + drag/leave usando los previous_* elegidos
  final_data AS (
    SELECT
      cd.*,

      -- revenue = subtotal
      (
        (cd.pass_raw + GREATEST(cd.claims, 0))
        - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
        - cd.successes
        + LEAST(cd.claims, 0)
      ) AS revenue,

      -- por prolijidad
      (cd.pass_raw + GREATEST(cd.claims, 0)) AS pass,
      ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2) AS cashier_commission,

      -- alias
      (cd.pass_raw + GREATEST(cd.claims, 0)
       - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
       - cd.successes
       + LEAST(cd.claims, 0)) AS subtotal,

      -- bills: del día anterior
      COALESCE(ps.previous_bills, 0) AS bills,

      -- total previo a leave
      (cd.prev_balance_chosen
       + (cd.pass_raw + GREATEST(cd.claims, 0)
          - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
          - cd.successes
          + LEAST(cd.claims, 0))
       - cd.collections
       + cd.paid) AS total_pre_leave,

      -- drag calculado
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        ELSE cd.prev_drag_eff_chosen
             + (cd.pass_raw + GREATEST(cd.claims, 0)
                - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
                - cd.successes
                + LEAST(cd.claims, 0))
      END AS drag_calc,

      -- leave calculado si corresponde (se mantiene)
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave
          THEN CASE WHEN (cd.prev_drag_eff_chosen
                          + (cd.pass_raw + GREATEST(cd.claims, 0)
                             - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
                             - cd.successes
                             + LEAST(cd.claims, 0))) > 0
                    THEN ROUND(
                      (cd.prev_drag_eff_chosen
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

      -- leave efectivo (nuevo si recalculamos, si no el existente)
      CASE
        WHEN fd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave THEN fd.leave_calc
        ELSE COALESCE(fd.leave_manual, 0)
      END AS leave_effective,

      -- total final siempre descuenta el leave efectivo
      (fd.total_pre_leave
       - CASE
           WHEN fd.fee_plus_pct <= 0 THEN 0
           WHEN p_calculate_leave THEN fd.leave_calc
           ELSE COALESCE(fd.leave_manual, 0)
         END) AS total_final,

      -- valores a guardar
      CASE WHEN fd.fee_plus_pct <= 0 THEN 0 ELSE fd.prev_drag_eff_chosen END AS previous_drag_to_store,
      fd.prev_balance_chosen AS previous_balance_to_store,

      CASE
        WHEN fd.fee_plus_pct <= 0 THEN 0
        ELSE fd.prev_drag_eff_chosen + fd.subtotal
      END AS drag_to_store
    FROM final_data fd
  ),

  -- 6) UPSERT
  upserted_rows AS (
    INSERT INTO current_accounts (
      current_account_id,
      user_id, user_name, user_number,
      pass, successes, claims,
      subtotal, previous_balance, collections, paid,
      total, drag, leave, date,
      created_at, edited_at,
      cashier_commission, bills, revenue, previous_drag,
      is_liquidated
    )
    SELECT
      gen_random_uuid(),
      r.user_id, r.user_name, r.user_number,
      r.pass, r.successes, r.claims,
      r.subtotal, r.previous_balance_to_store, r.collections, r.paid,
      r.total_final, r.drag_to_store,
      -- guardar leave: si recalculamos, el nuevo; si no, el existente/manual
      CASE WHEN p_calculate_leave THEN r.leave_calc ELSE COALESCE(r.leave_manual, 0) END,
      v_date,
      NOW(), NOW(),
      r.cashier_commission, r.bills, r.revenue, r.previous_drag_to_store,
      CASE WHEN p_liquidated THEN TRUE ELSE FALSE END
    FROM resolved r
    ON CONFLICT (user_id, date) DO UPDATE SET
      user_name          = EXCLUDED.user_name,
      user_number        = EXCLUDED.user_number,
      pass               = EXCLUDED.pass,
      successes          = EXCLUDED.successes,

      -- ⛔ manuales no se pisan
      claims             = current_accounts.claims,
      collections        = current_accounts.collections,
      paid               = current_accounts.paid,

      -- ✅ leave: sólo si hoy lo calculamos
      leave              = CASE
                             WHEN p_calculate_leave THEN EXCLUDED.leave
                             ELSE current_accounts.leave
                           END,

      -- ✅ derivados recalculados (ya incluyen leave efectivo en total)
      subtotal           = EXCLUDED.subtotal,
      -- ⛔ previous_* NO se pisan en updates
      previous_balance   = current_accounts.previous_balance,
      total              = EXCLUDED.total,
      drag               = EXCLUDED.drag,
      edited_at          = NOW(),
      cashier_commission = EXCLUDED.cashier_commission,
      bills              = EXCLUDED.bills,
      revenue            = EXCLUDED.revenue,
      previous_drag      = current_accounts.previous_drag,

      -- ✅ liquidación: sólo sube a TRUE; nunca baja
      is_liquidated      = CASE
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
