-- (Opcional pero recomendado) Limpiar duplicados previos
DELETE FROM current_accounts a
USING current_accounts b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.date    = b.date;

-- Restringe a una cuenta por usuario y día
ALTER TABLE current_accounts
  ADD CONSTRAINT current_accounts_user_date_uniq UNIQUE (user_id, date);


CREATE OR REPLACE FUNCTION calculate_current_account(p_date_text TEXT)
RETURNS JSONB[]
LANGUAGE plpgsql
AS $$
DECLARE
  date_from_input   DATE := to_date(p_date_text, 'DD-MM-YYYY');

  user_rec          RECORD;
  current_account_row JSONB;
  inserted_accounts JSONB[] := '{}'::JSONB[];

  v_pass               NUMERIC(12,2) := 0;
  v_successes          NUMERIC(12,2) := 0;
  v_cashier_commission NUMERIC(12,2) := 0;
  v_subtotal           NUMERIC(12,2) := 0;

  v_previous_balance   NUMERIC(12,2);
  v_collections        NUMERIC(12,2) := 0;
  v_paid               NUMERIC(12,2) := 0;
  v_bills              NUMERIC(12,2) := 0;
  v_revenue            NUMERIC(12,2) := 0;

  v_previous_drag      NUMERIC(12,2);
  v_drag               NUMERIC(12,2);
  v_total              NUMERIC(12,2);

  v_claims             NUMERIC(12,2) := 0;
  v_leave              NUMERIC(12,2) := 0;
  v_fee                NUMERIC(5,2)  := 0;
BEGIN
  FOR user_rec IN
    SELECT
      u.user_id,
      u.name,
      u.number,
      COALESCE(u.fee, 0) AS fee
    FROM users u
    WHERE u.user_type = 'CASHIER'
      AND u.deleted_at IS NULL
  LOOP
    -- Ventas / Premios del día
    SELECT
      COALESCE(SUM(t.total), 0),
      COALESCE(SUM(t.total_prize), 0)
    INTO v_pass, v_successes
    FROM tickets t
    WHERE t.user_id   = user_rec.user_id
      AND t.date      = date_from_input
      AND t.deleted_at IS NULL;

    v_fee                := user_rec.fee;
    v_cashier_commission := ROUND(v_pass * (v_fee / 100), 2);
    v_revenue            := v_pass - v_successes - v_cashier_commission;
    v_subtotal           := v_revenue;

    -- Traer saldo/arrastre del día anterior (si no hay, 0s)
    SELECT ca.total, ca.drag
    INTO v_previous_balance, v_previous_drag
    FROM current_accounts ca
    WHERE ca.user_id = user_rec.user_id
      AND ca.date    = date_from_input - INTERVAL '1 day'
    ORDER BY ca.date DESC
    LIMIT 1;

    IF NOT FOUND THEN
      v_previous_balance := 0;
      v_previous_drag    := 0;
    END IF;

    -- Regla de arrastre (corte de mes)
    IF EXTRACT(DAY FROM date_from_input) = 1 THEN
      IF v_previous_drag >= 0 THEN
        v_previous_drag := 0;
        v_drag := v_revenue;
      ELSE
        v_drag := v_previous_drag + v_revenue;
      END IF;
    ELSE
      v_drag := v_previous_drag + v_revenue;
    END IF;

    -- Total del día (ajustá signos si corresponde a tu negocio)
    v_total := v_previous_balance + v_subtotal - v_collections + v_paid + v_bills;

    -- UPSERT: crea o actualiza la cuenta del día
    INSERT INTO current_accounts (
      current_account_id,
      user_id,
      user_name,
      user_number,
      pass,
      successes,
      claims,
      subtotal,
      previous_balance,
      collections,
      paid,
      total,
      drag,
      leave,
      date,
      created_at,
      edited_at,
      cashier_commission,
      bills,
      revenue,
      previous_drag
    )
    VALUES (
      gen_random_uuid(),
      user_rec.user_id,
      user_rec.name,
      user_rec.number,
      v_pass,
      v_successes,
      v_claims,
      v_subtotal,
      v_previous_balance,
      v_collections,
      v_paid,
      v_total,
      v_drag,
      v_leave,
      date_from_input,
      NOW(),
      NOW(),
      v_cashier_commission,
      v_bills,
      v_revenue,
      v_previous_drag
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
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
      leave              = EXCLUDED.leave,
      edited_at          = NOW(),
      cashier_commission = EXCLUDED.cashier_commission,
      bills              = EXCLUDED.bills,
      revenue            = EXCLUDED.revenue,
      previous_drag      = EXCLUDED.previous_drag
    RETURNING TO_JSONB(current_accounts.*)
    INTO current_account_row;

    inserted_accounts := array_append(inserted_accounts, current_account_row);
  END LOOP;

  RETURN inserted_accounts;
END;
$$;
