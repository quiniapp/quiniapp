DROP FUNCTION IF EXISTS calculate_current_account(TEXT, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS calculate_current_account(TEXT, BOOLEAN);

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
    WHERE t.date = v_date
      AND t.deleted_at IS NULL
    GROUP BY t.user_id
  ),

  -- 2) Último estado anterior (< v_date)
  --    Aquí buscamos el día previo (ej: 31/01) para saber cómo arrancar hoy (01/02)
  previous_state AS (
    SELECT DISTINCT ON (ca.user_id)
      ca.user_id,
      ca.total AS previous_balance,
      ca.drag  AS previous_drag_raw, -- Para auditoría

      -- LÓGICA CORREGIDA DE REINICIO:
      -- Si el día anterior tuvo un "leave" (Deje) pagado (mayor a 0),
      -- el arrastre acumulado muere ahí y el nuevo día arranca en 0.
      -- Si no hubo deje, se trae el drag acumulado del día anterior.
      CASE
        WHEN COALESCE(ca.leave, 0)::NUMERIC > 0 THEN 0
        ELSE COALESCE(ca.drag, 0)::NUMERIC
      END AS previous_drag_rollover,

      ca.leave AS previous_leave,
      ca.bills AS previous_bills
    FROM current_accounts ca
    WHERE ca.date < v_date
      AND ca.deleted_at IS NULL
    ORDER BY ca.user_id, ca.date DESC
  ),

  -- 3) Día existente (si ya hay fila hoy, para mantener cargas manuales)
  existing_day AS (
    SELECT
      ca.user_id,
      COALESCE(ca.claims, 0)      AS claims,
      COALESCE(ca.collections, 0) AS collections,
      COALESCE(ca.paid, 0)        AS paid,
      COALESCE(ca.leave, 0)       AS leave
    FROM current_accounts ca
    WHERE ca.date = v_date
      AND ca.deleted_at IS NULL
  ),

  -- 4) Datos base combinados
  calculated_data AS (
    SELECT
      u.user_id,
      u.name   AS user_name,
      u.number AS user_number,

      COALESCE(da.pass_raw, 0)  AS pass_raw,
      COALESCE(da.successes, 0) AS successes,

      -- Manuales del día actual
      COALESCE(ed.claims, 0)      AS claims,
      GREATEST(COALESCE(ed.claims, 0), 0) AS claims_pos,
      LEAST(COALESCE(ed.claims, 0), 0)    AS claims_neg,

      COALESCE(ed.collections, 0) AS collections,
      COALESCE(ed.paid, 0)        AS paid,
      COALESCE(ed.leave, 0)       AS leave_manual,

      -- Saldo anterior (Siempre viene del día previo)
      COALESCE(ps.previous_balance, 0) AS prev_balance_chosen,

      -- Configuración de fees
      COALESCE(u.fee, 0) / 100.0      AS fee_pct,
      COALESCE(u.fee_plus, 0) / 100.0 AS fee_plus_pct,

      -- ARRASTRE INICIAL EFECTIVO PARA HOY:
      -- Si el usuario no tiene config de Deje (fee_plus <= 0), no usa arrastre (0).
      -- Si tiene, usa el rollover calculado en el paso 2 (que será 0 si ayer hubo deje).
      CASE
        WHEN COALESCE(u.fee_plus, 0) <= 0 THEN 0
        ELSE COALESCE(ps.previous_drag_rollover, 0)
      END AS prev_drag_eff_chosen

    FROM users u
    LEFT JOIN daily_activity da ON u.user_id = da.user_id
    LEFT JOIN previous_state ps ON u.user_id = ps.user_id
    LEFT JOIN existing_day ed   ON u.user_id = ed.user_id
    WHERE u.user_type = 'CASHIER'
      AND u.deleted_at IS NULL
  ),

  -- 5) Totales + drag/leave
  final_data AS (
    SELECT
      cd.*,

      -- Pass ajustado con claims
      (cd.pass_raw + GREATEST(cd.claims, 0)) AS pass,

      -- Comisión Cajero
      ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2) AS cashier_commission,

      -- Subtotal / Revenue (Ganancia de la casa hoy)
      (
        (cd.pass_raw + GREATEST(cd.claims, 0))
        - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
        - cd.successes
        + LEAST(cd.claims, 0)
      ) AS subtotal,

      -- Revenue duplicado para consistencia
      (
        (cd.pass_raw + GREATEST(cd.claims, 0))
        - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
        - cd.successes
        + LEAST(cd.claims, 0)
      ) AS revenue,

      -- Bills del día anterior (se arrastran)
      COALESCE(ps.previous_bills, 0) AS bills,

      -- Total antes de restar el Leave del día (si lo hubiera hoy)
      (cd.prev_balance_chosen
        + (
            (cd.pass_raw + GREATEST(cd.claims, 0))
            - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
            - cd.successes
            + LEAST(cd.claims, 0)
          )
        - cd.collections
        + cd.paid) AS total_pre_leave,

      -- DRAG CALCULADO (Acumulado hasta hoy)
      -- Toma el arrastre inicial (que es 0 si ayer hubo deje) + el subtotal de hoy
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        ELSE cd.prev_drag_eff_chosen + (
            (cd.pass_raw + GREATEST(cd.claims, 0))
            - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
            - cd.successes
            + LEAST(cd.claims, 0)
        )
      END AS drag_calc,

      -- LEAVE CALCULADO (Solo si p_calculate_leave es TRUE)
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave THEN
          CASE
            -- Calculamos el drag potencial
            WHEN (cd.prev_drag_eff_chosen + (
                (cd.pass_raw + GREATEST(cd.claims, 0))
                - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
                - cd.successes
                + LEAST(cd.claims, 0)
              )) > 0
            THEN ROUND(
              (cd.prev_drag_eff_chosen + (
                (cd.pass_raw + GREATEST(cd.claims, 0))
                - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
                - cd.successes
                + LEAST(cd.claims, 0)
              )) * cd.fee_plus_pct,
              2
            )
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

      -- Leave efectivo a usar
      CASE
        WHEN fd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave THEN fd.leave_calc
        ELSE COALESCE(fd.leave_manual, 0)
      END AS leave_effective,

      -- Total Final (restando leave efectivo)
      (fd.total_pre_leave
        - CASE
            WHEN fd.fee_plus_pct <= 0 THEN 0
            WHEN p_calculate_leave THEN fd.leave_calc
            ELSE COALESCE(fd.leave_manual, 0)
          END) AS total_final,

      -- Valores para guardar en DB:
      -- Previous Drag: Para el día 01/02, esto guardará 0 si el 31/01 hubo deje.
      CASE WHEN fd.fee_plus_pct <= 0 THEN 0 ELSE fd.prev_drag_eff_chosen END AS previous_drag_to_store,
      fd.prev_balance_chosen AS previous_balance_to_store,

      -- Drag: El acumulado real del día
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
      r.leave_effective,
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
      subtotal           = EXCLUDED.subtotal,
      
      -- Mantener manuales
      claims             = current_accounts.claims,
      collections        = current_accounts.collections,
      paid               = current_accounts.paid,

      -- Actualizar lógica de leave
      leave              = CASE
                             WHEN p_calculate_leave THEN EXCLUDED.leave
                             ELSE current_accounts.leave
                           END,

      previous_balance   = EXCLUDED.previous_balance,
      previous_drag      = EXCLUDED.previous_drag, -- Se actualiza según el recálculo
      total              = EXCLUDED.total,
      drag               = EXCLUDED.drag,
      
      edited_at          = NOW(),
      cashier_commission = EXCLUDED.cashier_commission,
      bills              = EXCLUDED.bills,
      revenue            = EXCLUDED.revenue,
      
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