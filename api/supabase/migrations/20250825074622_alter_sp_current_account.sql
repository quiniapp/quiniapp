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
  -- 1) Actividad del día (ventas/premios)
  daily_activity AS (
    SELECT
      t.user_id,
      COALESCE(SUM(t.total), 0)       AS pass,
      COALESCE(SUM(t.total_prize), 0) AS successes
    FROM tickets t
    WHERE t.date = v_date AND t.deleted_at IS NULL
    GROUP BY t.user_id
  ),

  -- 2) Último estado anterior a la fecha (para previous_balance/drag/bills)
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

  -- 3) Manuales del mismo día (si hay fila ya creada)
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

  -- 4) Cálculo (base + manuales)
  calculated_data AS (
    SELECT
      u.user_id,
      u.name   AS user_name,
      u.number AS user_number,

      COALESCE(da.pass, 0)      AS pass,
      COALESCE(da.successes, 0) AS successes,

      -- manuales (si no hay fila del día, 0)
      COALESCE(ed.claims, 0)      AS claims,
      COALESCE(ed.collections, 0) AS collections,
      COALESCE(ed.paid, 0)        AS paid,
      COALESCE(ed.leave, 0)       AS leave,

      COALESCE(ps.previous_balance, 0) AS previous_balance,
      COALESCE(ps.previous_drag, 0)    AS previous_drag,
      COALESCE(ps.previous_bills, 0)   AS bills,

      ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2) AS cashier_commission,

      -- base del día sin manuales (para referencia)
      (COALESCE(da.pass, 0) - COALESCE(da.successes, 0)
       - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2)) AS revenue,

      -- subtotal del día con manuales
      (COALESCE(da.pass, 0) - COALESCE(da.successes, 0)
       - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2)
       - COALESCE(ed.claims, 0)
       + COALESCE(ed.collections, 0)
       - COALESCE(ed.paid, 0)) AS subtotal,

      -- drag mensual con subtotal ajustado
      CASE
        WHEN ps.prev_ca_date IS NULL
          OR date_trunc('month', ps.prev_ca_date) <> date_trunc('month', v_date)
        THEN
          CASE
            WHEN COALESCE(ps.previous_drag, 0) >= 0
            THEN (COALESCE(da.pass, 0) - COALESCE(da.successes, 0)
                  - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2)
                  - COALESCE(ed.claims, 0) + COALESCE(ed.collections, 0) - COALESCE(ed.paid, 0))
            ELSE COALESCE(ps.previous_drag, 0) +
                 (COALESCE(da.pass, 0) - COALESCE(da.successes, 0)
                  - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2)
                  - COALESCE(ed.claims, 0) + COALESCE(ed.collections, 0) - COALESCE(ed.paid, 0))
          END
        ELSE
          COALESCE(ps.previous_drag, 0) +
          (COALESCE(da.pass, 0) - COALESCE(da.successes, 0)
           - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2)
           - COALESCE(ed.claims, 0) + COALESCE(ed.collections, 0) - COALESCE(ed.paid, 0))
      END AS drag,

      -- total acumulado = saldo anterior + subtotal del día (ajustado)
      (COALESCE(ps.previous_balance, 0) +
       (COALESCE(da.pass, 0) - COALESCE(da.successes, 0)
        - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2)
        - COALESCE(ed.claims, 0) + COALESCE(ed.collections, 0) - COALESCE(ed.paid, 0))) AS total
    FROM users u
    LEFT JOIN daily_activity da ON u.user_id = da.user_id
    LEFT JOIN previous_state ps ON u.user_id = ps.user_id
    LEFT JOIN existing_day ed   ON u.user_id = ed.user_id
    WHERE u.user_type = 'CASHIER' AND u.deleted_at IS NULL
  ),

  -- 5) UPSERT (no pisar manuales; sí actualizar derivados)
  upserted_rows AS (
    INSERT INTO current_accounts (
      current_account_id, user_id, user_name, user_number, pass, successes, claims,
      subtotal, previous_balance, collections, paid, total, drag, leave, date,
      created_at, edited_at, cashier_commission, bills, revenue, previous_drag
    )
    SELECT
      gen_random_uuid(), user_id, user_name, user_number, pass, successes, claims,
      subtotal, previous_balance, collections, paid, total, drag, leave, v_date,
      NOW(), NOW(), cashier_commission, bills, revenue, previous_drag
    FROM calculated_data
    ON CONFLICT (user_id, date) DO UPDATE SET
      user_name          = EXCLUDED.user_name,
      user_number        = EXCLUDED.user_number,
      pass               = EXCLUDED.pass,
      successes          = EXCLUDED.successes,

      -- ⛔ no tocar manuales
      claims             = current_accounts.claims,
      collections        = current_accounts.collections,
      paid               = current_accounts.paid,
      leave              = current_accounts.leave,

      -- ✅ actualizar derivados con manuales (ya incluidos en EXCLUDED.subtotal/drag/total)
      subtotal           = EXCLUDED.subtotal,
      previous_balance   = EXCLUDED.previous_balance,
      total              = EXCLUDED.total,
      drag               = EXCLUDED.drag,
      date               = EXCLUDED.date,
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
