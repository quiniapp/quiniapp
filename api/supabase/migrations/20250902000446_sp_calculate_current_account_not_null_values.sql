DROP FUNCTION IF EXISTS calculate_current_account(TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION calculate_current_account(
  p_date_text TEXT,
  p_calculate_leave BOOLEAN DEFAULT FALSE
)
RETURNS JSONB[]
LANGUAGE plpgsql
AS $$
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

  -- 3) Manuales del mismo día (si hay fila creada)
  existing_day AS (
    SELECT
      ca.user_id,
      COALESCE(ca.claims, 0)      AS claims,
      COALESCE(ca.collections, 0) AS collections,
      COALESCE(ca.paid, 0)        AS paid,
      COALESCE(ca.leave, 0)       AS leave
    FROM current_accounts ca
    WHERE ca.date = v_date
  ),

  -- 4) Cálculo según reglas
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
      COALESCE(ed.leave, 0)       AS leave_manual,   -- sólo se usa si NO calculamos leave

      -- si no hay fila anterior, estos COALESCE ya actúan como “IF NOT FOUND ⇒ 0”
      COALESCE(ps.previous_balance, 0)  AS previous_balance,
      COALESCE(ps.previous_drag_raw, 0) AS previous_drag_raw,
      COALESCE(ps.previous_leave,  0)   AS previous_leave,
      COALESCE(ps.previous_bills,  0)   AS previous_bills,

      COALESCE(u.fee, 0) / 100.0       AS fee_pct,
      COALESCE(u.fee_plus, 0) / 100.0  AS fee_plus_pct,

      -- previous_drag EFECTIVO (reset diferido y nulo si no hay fee_plus)
      CASE
        WHEN COALESCE(u.fee_plus, 0) <= 0 THEN 0
        WHEN COALESCE(ps.previous_leave, 0) > 0 AND COALESCE(ps.previous_drag_raw, 0) > 0 THEN 0
        ELSE COALESCE(ps.previous_drag_raw, 0)
      END AS previous_drag_eff,

      -- pass ajustado con claims positivos
      (COALESCE(da.pass_raw, 0) + GREATEST(COALESCE(ed.claims, 0), 0)) AS pass,

      -- comisión sobre pass ajustado
      ROUND(
        (COALESCE(da.pass_raw, 0) + GREATEST(COALESCE(ed.claims, 0), 0)) * (COALESCE(u.fee, 0) / 100.0),
        2
      ) AS cashier_commission,

      -- revenue (= subtotal)
      (
        (COALESCE(da.pass_raw, 0) + GREATEST(COALESCE(ed.claims, 0), 0))
        - ROUND(
            (COALESCE(da.pass_raw, 0) + GREATEST(COALESCE(ed.claims, 0), 0)) * (COALESCE(u.fee, 0) / 100.0),
            2
          )
        - COALESCE(da.successes, 0)
        + LEAST(COALESCE(ed.claims, 0), 0)
      ) AS revenue
    FROM users u
    LEFT JOIN daily_activity da ON u.user_id = da.user_id
    LEFT JOIN previous_state ps ON u.user_id = ps.user_id
    LEFT JOIN existing_day ed   ON u.user_id = ed.user_id
    WHERE u.user_type = 'CASHIER' AND u.deleted_at IS NULL
  ),

  -- 5) Totales + drag/leave
  final_data AS (
    SELECT
      cd.*,

      -- revenue = subtotal
      cd.revenue AS subtotal,

      -- bills: siempre del día anterior
      cd.previous_bills AS bills,

      -- total previo a leave
      (cd.previous_balance + cd.revenue - cd.collections + cd.paid) AS total_pre_leave,

      -- drag: 0 si no hay fee_plus, caso contrario previous_drag_eff + revenue
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        ELSE cd.previous_drag_eff + cd.revenue
      END AS drag_calc,

      -- leave calculado (solo si se pide y hay fee_plus; si no, conservar manual)
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave
          THEN CASE WHEN (cd.previous_drag_eff + cd.revenue) > 0
                    THEN ROUND((cd.previous_drag_eff + cd.revenue) * cd.fee_plus_pct, 2)
                    ELSE 0
               END
        ELSE cd.leave_manual
      END AS leave_calc,

      -- total final (si calculamos leave hoy, se descuenta)
      (cd.previous_balance + cd.revenue - cd.collections + cd.paid)
        - (CASE
             WHEN cd.fee_plus_pct <= 0 THEN 0
             WHEN p_calculate_leave
               THEN CASE WHEN (cd.previous_drag_eff + cd.revenue) > 0
                         THEN ROUND((cd.previous_drag_eff + cd.revenue) * cd.fee_plus_pct, 2)
                         ELSE 0
                    END
               ELSE 0
           END) AS total_final,

      -- previous_drag a guardar hoy: el EFECTIVO (ya con reset diferido aplicado),
      -- o 0 si no hay fee_plus
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        ELSE cd.previous_drag_eff
      END AS previous_drag_to_store,

      -- drag a guardar hoy
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        ELSE cd.previous_drag_eff + cd.revenue
      END AS drag_to_store
    FROM calculated_data cd
  ),

  -- 6) UPSERT (no tocar manuales; excepto leave si p_calculate_leave=TRUE)
  upserted_rows AS (
    INSERT INTO current_accounts (
      current_account_id,
      user_id, user_name, user_number,
      pass, successes, claims,
      subtotal, previous_balance, collections, paid,
      total, drag, leave, date,
      created_at, edited_at,
      cashier_commission, bills, revenue, previous_drag
    )
    SELECT
      gen_random_uuid(),
      user_id, user_name, user_number,
      pass, successes, claims,
      subtotal, previous_balance, collections, paid,
      total_final, drag_to_store,
      CASE
        WHEN p_calculate_leave THEN leave_calc
        ELSE leave_manual
      END,
      v_date,
      NOW(), NOW(),
      cashier_commission, bills, revenue, previous_drag_to_store
    FROM final_data
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

      -- ✅ derivados
      subtotal           = EXCLUDED.subtotal,
      previous_balance   = EXCLUDED.previous_balance,
      total              = EXCLUDED.total,
      drag               = EXCLUDED.drag,
      edited_at          = NOW(),
      cashier_commission = EXCLUDED.cashier_commission,
      bills              = EXCLUDED.bills,
      revenue            = EXCLUDED.revenue,
      previous_drag      = EXCLUDED.previous_drag
    RETURNING TO_JSONB(current_accounts.*) AS json_row
  )
  SELECT COALESCE(array_agg(upserted_rows.json_row), '{}'::JSONB[])
  INTO result_array
  FROM upserted_rows;

  RETURN result_array;
END;
$$;


ALTER TABLE current_accounts
  ALTER COLUMN previous_balance SET DEFAULT 0,
  ALTER COLUMN previous_drag    SET DEFAULT 0,
  ALTER COLUMN bills            SET DEFAULT 0,
  ALTER COLUMN subtotal         SET DEFAULT 0,
  ALTER COLUMN revenue          SET DEFAULT 0,
  ALTER COLUMN total            SET DEFAULT 0,
  ALTER COLUMN drag             SET DEFAULT 0,
  ALTER COLUMN leave            SET DEFAULT 0;

-- Si además son NOT NULL (recomendado)
ALTER TABLE current_accounts
  ALTER COLUMN previous_balance SET NOT NULL,
  ALTER COLUMN previous_drag    SET NOT NULL,
  ALTER COLUMN bills            SET NOT NULL,
  ALTER COLUMN subtotal         SET NOT NULL,
  ALTER COLUMN revenue          SET NOT NULL,
  ALTER COLUMN total            SET NOT NULL,
  ALTER COLUMN drag             SET NOT NULL,
  ALTER COLUMN leave            SET NOT NULL;
