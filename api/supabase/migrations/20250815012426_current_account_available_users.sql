-- (Opcional pero recomendado) Limpiar duplicados previos
DELETE FROM current_accounts a
USING current_accounts b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.date    = b.date;

-- Restringe a una cuenta por usuario y día
ALTER TABLE current_accounts
  ADD CONSTRAINT current_accounts_user_date_uniq UNIQUE (user_id, date);

DROP FUNCTION IF EXISTS calculate_current_account(TEXT);
-- Crea la nueva función optimizada.
CREATE OR REPLACE FUNCTION calculate_current_account(p_date_text TEXT)
RETURNS JSONB[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_date DATE := to_date(p_date_text, 'DD-MM-YYYY');
  result_array JSONB[];
BEGIN
  WITH
  -- 1. Obtenemos las ventas y premios del día para cada cajero.
  daily_activity AS (
    SELECT
      t.user_id,
      COALESCE(SUM(t.total), 0) AS pass,
      COALESCE(SUM(t.total_prize), 0) AS successes
    FROM tickets t
    WHERE t.date = v_date AND t.deleted_at IS NULL
    GROUP BY t.user_id
  ),

  -- 2. Obtenemos el último estado de cuenta de cada cajero ANTERIOR a la fecha dada.
  previous_state AS (
    SELECT DISTINCT ON (ca.user_id)
      ca.user_id,
      ca.total AS previous_balance,
      ca.drag AS previous_drag,
      ca.bills AS previous_bills,
      ca.date AS prev_ca_date
    FROM current_accounts ca
    WHERE ca.date < v_date
    ORDER BY ca.user_id, ca.date DESC
  ),

  -- 3. Calculamos todos los campos nuevos y los preparamos para el UPSERT.
  calculated_data AS (
    SELECT
      u.user_id,
      u.name AS user_name,
      u.number AS user_number,
      COALESCE(da.pass, 0) AS pass,
      COALESCE(da.successes, 0) AS successes,
      0::NUMERIC(12,2) AS claims, -- Valor fijo, como en tu función original
      0::NUMERIC(12,2) AS collections, -- Valor fijo
      0::NUMERIC(12,2) AS paid, -- Valor fijo
      0::NUMERIC(12,2) AS leave, -- Valor fijo
      COALESCE(ps.previous_balance, 0) AS previous_balance,
      COALESCE(ps.previous_drag, 0) AS previous_drag,
      COALESCE(ps.previous_bills, 0) AS bills, -- Copia del anterior
      ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2) AS cashier_commission,
      -- revenue
      (COALESCE(da.pass, 0) - COALESCE(da.successes, 0) - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2)) AS revenue,
      -- subtotal (es igual a revenue en tu lógica)
      (COALESCE(da.pass, 0) - COALESCE(da.successes, 0) - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2)) AS subtotal,
      -- drag (lógica de reinicio de mes con CASE)
      CASE
        WHEN ps.prev_ca_date IS NULL OR date_trunc('month', ps.prev_ca_date) <> date_trunc('month', v_date) THEN
          CASE
            WHEN COALESCE(ps.previous_drag, 0) >= 0 THEN (COALESCE(da.pass, 0) - COALESCE(da.successes, 0) - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2))
            ELSE COALESCE(ps.previous_drag, 0) + (COALESCE(da.pass, 0) - COALESCE(da.successes, 0) - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2))
          END
        ELSE
          COALESCE(ps.previous_drag, 0) + (COALESCE(da.pass, 0) - COALESCE(da.successes, 0) - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2))
      END AS drag,
      -- total
      (COALESCE(ps.previous_balance, 0) + (COALESCE(da.pass, 0) - COALESCE(da.successes, 0) - ROUND(COALESCE(da.pass, 0) * (COALESCE(u.fee, 0) / 100), 2))) AS total
    FROM users u
    LEFT JOIN daily_activity da ON u.user_id = da.user_id
    LEFT JOIN previous_state ps ON u.user_id = ps.user_id
    WHERE u.user_type = 'CASHIER' AND u.deleted_at IS NULL
  ),

  -- 4. Hacemos el UPSERT (INSERT ... ON CONFLICT) con todos los datos calculados.
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
      claims             = EXCLUDED.claims,
      subtotal           = EXCLUDED.subtotal,
      previous_balance   = EXCLUDED.previous_balance,
      collections        = EXCLUDED.collections,
      paid               = EXCLUDED.paid,
      total              = EXCLUDED.total,
      drag               = EXCLUDED.drag,
      edited_at          = NOW(),
      cashier_commission = EXCLUDED.cashier_commission,
      bills              = EXCLUDED.bills,
      revenue            = EXCLUDED.revenue,
      previous_drag      = EXCLUDED.previous_drag
    RETURNING TO_JSONB(current_accounts.*)
  )
  -- 5. Finalmente, recolectamos los resultados en un array de JSONB.
  SELECT COALESCE(array_agg(upserted_rows), '{}'::JSONB[])
  INTO result_array
  FROM upserted_rows;

  RETURN result_array;
END;
$$;