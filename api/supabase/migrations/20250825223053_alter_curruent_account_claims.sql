DROP FUNCTION IF EXISTS calculate_current_account(TEXT);
CREATE OR REPLACE FUNCTION calculate_current_account(p_date_text TEXT)
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
      ca.drag  AS previous_drag,
      ca.bills AS previous_bills,
      ca.date  AS prev_ca_date
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
      COALESCE(ca.paid, 0)      AS paid,
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

      COALESCE(da.pass_raw, 0)      AS pass_raw,
      COALESCE(da.successes, 0)     AS successes,
      COALESCE(ed.claims, 0)        AS claims,
      GREATEST(COALESCE(ed.claims,0), 0) AS claims_pos,
      LEAST(COALESCE(ed.claims,0), 0)    AS claims_neg,

      COALESCE(ed.collections, 0)   AS collections,
      COALESCE(ed.paid, 0)        AS paid,
      COALESCE(ed.leave, 0)         AS leave,

      COALESCE(ps.previous_balance, 0) AS previous_balance,
      COALESCE(ps.previous_drag, 0)    AS previous_drag,
      COALESCE(ps.previous_bills, 0)   AS bills,
      COALESCE(u.fee, 0) / 100.0       AS fee_pct,

      -- pass ajustado con claims positivos
      (COALESCE(da.pass_raw, 0) + GREATEST(COALESCE(ed.claims, 0), 0)) AS pass,

      -- comisión sobre pass ajustado
      ROUND(
        (COALESCE(da.pass_raw, 0) + GREATEST(COALESCE(ed.claims, 0), 0)) * (COALESCE(u.fee, 0) / 100.0),
        2
      ) AS cashier_commission,

      -- subtotal/revenue: pass - comisión - successes + claims_neg
      (
        (COALESCE(da.pass_raw, 0) + GREATEST(COALESCE(ed.claims, 0), 0))
        - ROUND(
            (COALESCE(da.pass_raw, 0) + GREATEST(COALESCE(ed.claims, 0), 0)) * (COALESCE(u.fee, 0) / 100.0),
            2
          )
        - COALESCE(da.successes, 0)
        + LEAST(COALESCE(ed.claims, 0), 0)
      ) AS subtotal,

      -- revenue = subtotal
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

  -- 5) Totales acumulados (total/drag)
  final_data AS (
    SELECT
      cd.*,
      -- total = saldo anterior + revenue - collections + paid
      (cd.previous_balance + cd.revenue - cd.collections + cd.paid) AS total,

      -- drag = previous_drag + revenue
      (cd.previous_drag + cd.revenue) AS drag
    FROM calculated_data cd
  ),

  -- 6) UPSERT (no tocar manuales)
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
      total, drag, leave, v_date,
      NOW(), NOW(),
      cashier_commission, bills, revenue, previous_drag
    FROM final_data
    ON CONFLICT (user_id, date) DO UPDATE SET
      user_name          = EXCLUDED.user_name,
      user_number        = EXCLUDED.user_number,
      pass               = EXCLUDED.pass,
      successes          = EXCLUDED.successes,

      -- ⛔ manuales no se pisan
      claims             = current_accounts.claims,
      collections        = current_accounts.collections,
      paid             = current_accounts.paid,
      leave              = current_accounts.leave,

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
