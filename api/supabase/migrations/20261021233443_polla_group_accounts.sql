-- Polla: cuenta corriente del grupo y borrado de un grupo.
--
-- El capitalista (o superadmin) liquida a cada pasador como hasta ahora. Una
-- vez liquidados todos los pasadores de un grupo a una fecha, se liquida el
-- grupo: lo que dejaron sus pasadores en el período, menos los gastos del
-- grupo, más el arrastre negativo que venía. Si eso da positivo, el admin
-- cobra su comisión (el % se escribe al liquidar) y el arrastre vuelve a cero;
-- si no, no hay comisión y se arrastra al período siguiente.
--
-- La cuenta del grupo es lo que la organización le debe al admin:
-- total = saldo anterior + comisión + ajustes - pagado al admin.

-- ============================================================
-- 1. Tabla
-- ============================================================

CREATE TABLE IF NOT EXISTS polla_group_accounts (
  polla_group_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  polla_group_id UUID NOT NULL REFERENCES polla_groups(polla_group_id),
  group_name TEXT NOT NULL,
  -- Fecha de la liquidación (último día del período).
  date DATE NOT NULL,
  period_from DATE NOT NULL,

  -- Lo que dejaron los pasadores del grupo en el período (suma de subtotales).
  cashiers_subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- cashiers_subtotal - expenses
  base NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Arrastre negativo con el que arrancó el período (0 o menos).
  previous_drag NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- previous_drag + base
  drag_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  admin_percentage NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (admin_percentage >= 0 AND admin_percentage <= 100),
  admin_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Arrastre que pasa al período siguiente (0 o menos).
  drag NUMERIC(12,2) NOT NULL DEFAULT 0,

  previous_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  adjustments NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,

  created_by UUID REFERENCES polla_users(polla_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT polla_group_accounts_group_date_uniq UNIQUE (polla_group_id, date),
  CONSTRAINT polla_group_accounts_period_check CHECK (period_from <= date)
);

CREATE INDEX IF NOT EXISTS idx_polla_group_accounts_org_date
  ON polla_group_accounts (polla_organization_id, date);

ALTER TABLE polla_group_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE polla_group_accounts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE polla_group_accounts TO service_role;

-- Filas de cuenta corriente por grupo (snapshot del grupo del pasador).
CREATE INDEX IF NOT EXISTS idx_polla_current_accounts_group_date
  ON polla_current_accounts (polla_group_id, date)
  WHERE polla_group_id IS NOT NULL;

-- ============================================================
-- 2. Pasadores del grupo con movimientos sin liquidar hasta una fecha
-- ============================================================

DROP FUNCTION IF EXISTS polla_group_pending_cashiers(UUID, DATE);

CREATE FUNCTION polla_group_pending_cashiers(
  p_group_id UUID,
  p_date DATE DEFAULT NULL
)
RETURNS TABLE (
  polla_user_id UUID,
  name TEXT,
  number INTEGER,
  liquidated_on DATE
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH cashiers AS (
    SELECT u.polla_user_id, u.name, u.number
    FROM polla_users u
    WHERE u.polla_group_id = p_group_id
      AND u.user_type = 'CASHIER'
      AND u.deleted_at IS NULL
  ),
  last_liquidation AS (
    SELECT c.polla_user_id, MAX(ca.date) AS liquidated_on
    FROM cashiers c
    LEFT JOIN polla_current_accounts ca
      ON ca.polla_user_id = c.polla_user_id
     AND ca.is_liquidated
    GROUP BY c.polla_user_id
  )
  SELECT c.polla_user_id, c.name, c.number, l.liquidated_on
  FROM cashiers c
  JOIN last_liquidation l ON l.polla_user_id = c.polla_user_id
  WHERE EXISTS (
    -- Filas calculadas con movimientos después de su última liquidación.
    SELECT 1
    FROM polla_current_accounts ca
    WHERE ca.polla_user_id = c.polla_user_id
      AND (l.liquidated_on IS NULL OR ca.date > l.liquidated_on)
      AND (p_date IS NULL OR ca.date <= p_date)
      AND NOT ca.is_liquidated
      AND (ca.bets_pass <> 0 OR ca.deleted_pass <> 0 OR ca.successes <> 0
           OR ca.claims <> 0 OR ca.collections <> 0 OR ca.paid <> 0)
  ) OR EXISTS (
    -- Jugadas que todavía no se calcularon en la cuenta corriente.
    SELECT 1
    FROM polla_bets b
    WHERE b.cashier_polla_user_id = c.polla_user_id
      AND (
        (b.amount <> 0 AND b.deleted_at IS NULL
          AND (l.liquidated_on IS NULL OR b.load_date > l.liquidated_on)
          AND (p_date IS NULL OR b.load_date <= p_date))
        OR (b.amount <> 0 AND b.deducted_on IS NOT NULL
          AND (l.liquidated_on IS NULL OR b.deducted_on > l.liquidated_on)
          AND (p_date IS NULL OR b.deducted_on <= p_date))
        OR (b.winner AND b.deleted_at IS NULL
          AND (l.liquidated_on IS NULL OR b.hit_date > l.liquidated_on)
          AND (p_date IS NULL OR b.hit_date <= p_date))
      )
  )
  ORDER BY c.number NULLS LAST, c.name;
$$;

REVOKE ALL ON FUNCTION polla_group_pending_cashiers(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_group_pending_cashiers(UUID, DATE) TO service_role;

-- ============================================================
-- 3. Vista previa de la liquidación del grupo a una fecha
-- ============================================================

DROP FUNCTION IF EXISTS polla_group_account_preview(UUID, UUID, DATE);

CREATE FUNCTION polla_group_account_preview(
  p_organization_id UUID,
  p_group_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_group polla_groups;
  v_last polla_group_accounts;
  v_later DATE;
  v_from DATE;
  v_subtotal NUMERIC(12,2);
  v_expenses NUMERIC(12,2);
  v_pending JSONB;
BEGIN
  SELECT * INTO v_group
  FROM polla_groups
  WHERE polla_group_id = p_group_id
    AND polla_organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_GROUP_NOT_FOUND';
  END IF;

  -- La liquidación anterior (una del mismo día se rehace).
  SELECT * INTO v_last
  FROM polla_group_accounts
  WHERE polla_group_id = p_group_id
    AND date < p_date
  ORDER BY date DESC
  LIMIT 1;

  SELECT MIN(date) INTO v_later
  FROM polla_group_accounts
  WHERE polla_group_id = p_group_id
    AND date > p_date;

  -- Sin liquidación anterior arranca en el primer día con movimientos.
  v_from := COALESCE(
    v_last.date + 1,
    (SELECT MIN(ca.date) FROM polla_current_accounts ca
      WHERE ca.polla_group_id = p_group_id AND ca.date <= p_date),
    p_date
  );

  SELECT COALESCE(SUM(ca.subtotal), 0) INTO v_subtotal
  FROM polla_current_accounts ca
  WHERE ca.polla_organization_id = p_organization_id
    AND ca.polla_group_id = p_group_id
    AND ca.date BETWEEN v_from AND p_date;

  SELECT COALESCE(SUM(e.amount), 0) INTO v_expenses
  FROM polla_org_expenses e
  WHERE e.polla_organization_id = p_organization_id
    AND e.polla_group_id = p_group_id
    AND e.date BETWEEN v_from AND p_date;

  SELECT COALESCE(jsonb_agg(to_jsonb(p.*)), '[]'::JSONB) INTO v_pending
  FROM polla_group_pending_cashiers(p_group_id, p_date) p;

  RETURN jsonb_build_object(
    'polla_group_id', p_group_id,
    'group_name', v_group.name,
    'date', p_date,
    'period_from', v_from,
    'cashiers_subtotal', v_subtotal,
    'expenses', v_expenses,
    'base', v_subtotal - v_expenses,
    'previous_drag', COALESCE(v_last.drag, 0),
    'drag_base', COALESCE(v_last.drag, 0) + v_subtotal - v_expenses,
    'previous_balance', COALESCE(v_last.total, 0),
    'last_liquidation_date', v_last.date,
    'later_liquidation_date', v_later,
    'pending_cashiers', v_pending
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_group_account_preview(UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_group_account_preview(UUID, UUID, DATE) TO service_role;

-- ============================================================
-- 4. Liquidar el grupo
-- ============================================================

DROP FUNCTION IF EXISTS polla_liquidate_group(UUID, UUID, DATE, NUMERIC, NUMERIC, NUMERIC, UUID);

CREATE FUNCTION polla_liquidate_group(
  p_organization_id UUID,
  p_group_id UUID,
  p_date DATE,
  p_percentage NUMERIC,
  p_adjustments NUMERIC,
  p_paid NUMERIC,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_preview JSONB;
  v_drag_base NUMERIC(12,2);
  v_commission NUMERIC(12,2);
  v_drag NUMERIC(12,2);
  v_row polla_group_accounts;
BEGIN
  IF p_percentage IS NULL OR p_percentage < 0 OR p_percentage > 100 THEN
    RAISE EXCEPTION 'POLLA_GROUP_PERCENTAGE_INVALID';
  END IF;

  -- Una liquidación de grupo por vez.
  PERFORM 1 FROM polla_groups
  WHERE polla_group_id = p_group_id
  FOR UPDATE;

  v_preview := polla_group_account_preview(p_organization_id, p_group_id, p_date);

  IF v_preview->>'later_liquidation_date' IS NOT NULL THEN
    RAISE EXCEPTION 'POLLA_GROUP_ACCOUNT_LATER_EXISTS';
  END IF;

  IF jsonb_array_length(v_preview->'pending_cashiers') > 0 THEN
    RAISE EXCEPTION 'POLLA_GROUP_CASHIERS_PENDING';
  END IF;

  v_drag_base := (v_preview->>'drag_base')::NUMERIC;

  IF v_drag_base > 0 THEN
    v_commission := ROUND(v_drag_base * p_percentage / 100, 2);
    v_drag := 0;
  ELSE
    v_commission := 0;
    v_drag := v_drag_base;
  END IF;

  INSERT INTO polla_group_accounts (
    polla_organization_id, polla_group_id, group_name, date, period_from,
    cashiers_subtotal, expenses, base, previous_drag, drag_base,
    admin_percentage, admin_commission, drag,
    previous_balance, adjustments, paid, total,
    created_by
  ) VALUES (
    p_organization_id,
    p_group_id,
    v_preview->>'group_name',
    p_date,
    (v_preview->>'period_from')::DATE,
    (v_preview->>'cashiers_subtotal')::NUMERIC,
    (v_preview->>'expenses')::NUMERIC,
    (v_preview->>'base')::NUMERIC,
    (v_preview->>'previous_drag')::NUMERIC,
    v_drag_base,
    p_percentage,
    v_commission,
    v_drag,
    (v_preview->>'previous_balance')::NUMERIC,
    COALESCE(p_adjustments, 0),
    COALESCE(p_paid, 0),
    (v_preview->>'previous_balance')::NUMERIC + v_commission
      + COALESCE(p_adjustments, 0) - COALESCE(p_paid, 0),
    p_actor_id
  )
  ON CONFLICT (polla_group_id, date) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    period_from = EXCLUDED.period_from,
    cashiers_subtotal = EXCLUDED.cashiers_subtotal,
    expenses = EXCLUDED.expenses,
    base = EXCLUDED.base,
    previous_drag = EXCLUDED.previous_drag,
    drag_base = EXCLUDED.drag_base,
    admin_percentage = EXCLUDED.admin_percentage,
    admin_commission = EXCLUDED.admin_commission,
    drag = EXCLUDED.drag,
    previous_balance = EXCLUDED.previous_balance,
    adjustments = EXCLUDED.adjustments,
    paid = EXCLUDED.paid,
    total = EXCLUDED.total,
    created_by = EXCLUDED.created_by,
    edited_at = NOW()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION polla_liquidate_group(UUID, UUID, DATE, NUMERIC, NUMERIC, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_liquidate_group(UUID, UUID, DATE, NUMERIC, NUMERIC, NUMERIC, UUID) TO service_role;

-- ============================================================
-- 5. Borrar un grupo: con su admin, pasadores y jugadores
-- ============================================================

DROP FUNCTION IF EXISTS polla_delete_group(UUID, UUID);

CREATE FUNCTION polla_delete_group(
  p_group_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_group polla_groups;
  v_last_group_liquidation DATE;
  v_users UUID[];
BEGIN
  SELECT * INTO v_group
  FROM polla_groups
  WHERE polla_group_id = p_group_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_GROUP_NOT_FOUND';
  END IF;

  -- Jugadas del grupo que todavía juegan.
  IF EXISTS (
    SELECT 1
    FROM polla_bets b
    JOIN polla_editions e ON e.polla_edition_id = b.polla_edition_id
    WHERE b.polla_group_id = p_group_id
      AND b.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND e.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'POLLA_GROUP_HAS_ACTIVE_BETS';
  END IF;

  -- Pasadores con movimientos sin liquidar.
  IF EXISTS (SELECT 1 FROM polla_group_pending_cashiers(p_group_id, NULL)) THEN
    RAISE EXCEPTION 'POLLA_GROUP_CASHIERS_PENDING';
  END IF;

  -- Lo que dejaron los pasadores después de la última liquidación del grupo.
  SELECT MAX(date) INTO v_last_group_liquidation
  FROM polla_group_accounts
  WHERE polla_group_id = p_group_id;

  IF EXISTS (
    SELECT 1 FROM polla_current_accounts ca
    WHERE ca.polla_group_id = p_group_id
      AND (v_last_group_liquidation IS NULL OR ca.date > v_last_group_liquidation)
      AND ca.subtotal <> 0
  ) OR EXISTS (
    SELECT 1 FROM polla_org_expenses e
    WHERE e.polla_group_id = p_group_id
      AND (v_last_group_liquidation IS NULL OR e.date > v_last_group_liquidation)
  ) THEN
    RAISE EXCEPTION 'POLLA_GROUP_ACCOUNT_OPEN';
  END IF;

  SELECT COALESCE(array_agg(u.polla_user_id), '{}') INTO v_users
  FROM polla_users u
  WHERE u.deleted_at IS NULL
    AND (
      u.polla_group_id = p_group_id
      OR u.parent_polla_user_id IN (
        SELECT c.polla_user_id FROM polla_users c
        WHERE c.polla_group_id = p_group_id AND c.user_type = 'CASHIER'
      )
    );

  UPDATE polla_users
  SET deleted_at = NOW(),
      edited_at = NOW()
  WHERE polla_user_id = ANY (v_users);

  UPDATE polla_sessions
  SET is_active = FALSE,
      revoked_at = NOW()
  WHERE polla_user_id = ANY (v_users)
    AND is_active;

  UPDATE polla_groups
  SET deleted_at = NOW(),
      edited_at = NOW()
  WHERE polla_group_id = p_group_id;

  RETURN jsonb_build_object(
    'success', true,
    'polla_group_id', p_group_id,
    'deleted_users', cardinality(v_users)
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_delete_group(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_delete_group(UUID, UUID) TO service_role;
