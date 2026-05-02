CREATE OR REPLACE FUNCTION cascade_current_account_from_date(
  p_from_date_text TEXT,
  p_organization_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_date    DATE := to_date(p_from_date_text, 'DD-MM-YYYY');
  v_user         RECORD;
  v_record       RECORD;
  v_prev_total   NUMERIC;
  v_prev_drag    NUMERIC; -- effective prev_drag (after leave-reset)
  v_anchor_drag  NUMERIC;
  v_anchor_leave NUMERIC;
  v_new_total    NUMERIC;
  v_new_drag     NUMERIC;
  v_new_leave    NUMERIC;
BEGIN
  FOR v_user IN
    SELECT DISTINCT
      ca.user_id,
      COALESCE(u.fee_plus, 0) / 100.0 AS fee_plus_pct
    FROM current_accounts ca
    JOIN users u ON u.user_id = ca.user_id
    WHERE ca.date > v_from_date
      AND ca.organization_id = p_organization_id
      AND (p_user_id IS NULL OR ca.user_id = p_user_id)
  LOOP
    SELECT
      COALESCE(ca.total, 0),
      COALESCE(ca.drag, 0),
      COALESCE(ca.leave, 0)
    INTO v_prev_total, v_anchor_drag, v_anchor_leave
    FROM current_accounts ca
    WHERE ca.user_id = v_user.user_id
      AND ca.date = v_from_date
      AND ca.organization_id = p_organization_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Apply leave-reset: if anchor day had leave > 0, next day starts with drag = 0
    IF v_anchor_leave > 0 AND v_anchor_drag > 0 THEN
      v_prev_drag := 0;
    ELSE
      v_prev_drag := v_anchor_drag;
    END IF;

    FOR v_record IN
      SELECT *
      FROM current_accounts
      WHERE user_id = v_user.user_id
        AND date > v_from_date
        AND organization_id = p_organization_id
      ORDER BY date ASC
    LOOP
      v_new_total := v_prev_total
                   + COALESCE(v_record.subtotal, 0)
                   - COALESCE(v_record.collections, 0)
                   + COALESCE(v_record.paid, 0);

      IF v_user.fee_plus_pct > 0 THEN
        v_new_drag := v_prev_drag + COALESCE(v_record.subtotal, 0);
      ELSE
        v_new_drag := 0;
      END IF;

      -- Recalculate leave only if it was previously applied on this record
      IF COALESCE(v_record.leave, 0) > 0 THEN
        IF v_new_drag > 0 THEN
          v_new_leave := ROUND(v_new_drag * v_user.fee_plus_pct, 2);
        ELSE
          v_new_leave := 0;
        END IF;
        v_new_total := v_new_total - v_new_leave;
      ELSE
        v_new_leave := 0;
      END IF;

      UPDATE current_accounts
      SET
        previous_balance = v_prev_total,
        previous_drag    = v_prev_drag,
        total            = v_new_total,
        drag             = v_new_drag,
        leave            = v_new_leave,
        edited_at        = NOW()
      WHERE current_account_id = v_record.current_account_id;

      v_prev_total := v_new_total;
      -- Leave-reset for next record: if this day applied leave, next day's drag starts at 0
      IF v_new_leave > 0 AND v_new_drag > 0 THEN
        v_prev_drag := 0;
      ELSE
        v_prev_drag := v_new_drag;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
