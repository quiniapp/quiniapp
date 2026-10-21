-- Polla: ventas del día, gastos y totales de la cuenta corriente.
--
-- * polla_daily_sales: boletas vendidas y monto de un día, por grupo. El
--   pasador la pide con su id y recibe solo lo imputado a él.
-- * polla_org_expenses: gastos de la organización por día (y opcionalmente por
--   grupo), los mismos que QuiniApp guarda en org_expenses para el ticket de
--   cobros y pagos.
-- * polla_current_account_daily_totals: totales de la cuenta corriente por día
--   para el pie de la tabla, el ticket de cobros y pagos, el resumen y los
--   subtotales. Se agrega en SQL en vez de traer todas las filas a Node.

-- ============================================================
-- 1. Ventas del día
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_polla_bets_org_load_date
  ON polla_bets (polla_organization_id, load_date)
  WHERE deleted_at IS NULL;

DROP FUNCTION IF EXISTS polla_daily_sales(UUID, DATE, UUID);

CREATE FUNCTION polla_daily_sales(
  p_organization_id UUID,
  p_date DATE,
  p_cashier_id UUID DEFAULT NULL
)
RETURNS TABLE (
  polla_group_id UUID,
  group_name TEXT,
  bets_count BIGINT,
  amount NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    b.polla_group_id,
    g.name AS group_name,
    COUNT(*) AS bets_count,
    COALESCE(SUM(b.amount), 0) AS amount
  FROM polla_bets b
  LEFT JOIN polla_groups g ON g.polla_group_id = b.polla_group_id
  WHERE b.polla_organization_id = p_organization_id
    AND b.load_date = p_date
    AND b.deleted_at IS NULL
    AND (p_cashier_id IS NULL OR b.cashier_polla_user_id = p_cashier_id)
  GROUP BY b.polla_group_id, g.name
  ORDER BY g.name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION polla_daily_sales(UUID, DATE, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_daily_sales(UUID, DATE, UUID) TO service_role;

-- ============================================================
-- 2. Gastos de la organización
-- ============================================================

CREATE TABLE polla_org_expenses (
  polla_org_expense_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  -- NULL = gasto de la organización; con grupo, gasto de ese grupo.
  polla_group_id UUID REFERENCES polla_groups(polla_group_id),
  date DATE NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_by UUID REFERENCES polla_users(polla_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_polla_org_expenses_org_date
  ON polla_org_expenses (polla_organization_id, date);

ALTER TABLE polla_org_expenses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE polla_org_expenses FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE polla_org_expenses TO service_role;

-- ============================================================
-- 3. Totales de la cuenta corriente por día
-- ============================================================

DROP FUNCTION IF EXISTS polla_current_account_daily_totals(UUID, DATE, DATE, UUID, UUID);

CREATE FUNCTION polla_current_account_daily_totals(
  p_organization_id UUID,
  p_from DATE,
  p_to DATE,
  p_group_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  date DATE,
  accounts_count BIGINT,
  total_pass NUMERIC,
  total_successes NUMERIC,
  total_commission NUMERIC,
  total_claims NUMERIC,
  total_bills NUMERIC,
  total_revenue NUMERIC,
  total_subtotal NUMERIC,
  total_previous_balance NUMERIC,
  total_collections NUMERIC,
  total_paid NUMERIC,
  total_total NUMERIC,
  total_expenses NUMERIC,
  net_balance NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH accounts AS (
    SELECT
      ca.date,
      COUNT(*) AS accounts_count,
      SUM(ca.pass) AS total_pass,
      SUM(ca.successes) AS total_successes,
      SUM(ca.cashier_commission) AS total_commission,
      SUM(ca.claims) AS total_claims,
      SUM(ca.bills) AS total_bills,
      SUM(ca.revenue) AS total_revenue,
      SUM(ca.subtotal) AS total_subtotal,
      SUM(ca.previous_balance) AS total_previous_balance,
      SUM(ca.collections) AS total_collections,
      SUM(ca.paid) AS total_paid,
      SUM(ca.total) AS total_total
    FROM polla_current_accounts ca
    WHERE ca.polla_organization_id = p_organization_id
      AND ca.date BETWEEN p_from AND p_to
      AND (p_group_id IS NULL OR ca.polla_group_id = p_group_id)
      AND (p_user_id IS NULL OR ca.polla_user_id = p_user_id)
    GROUP BY ca.date
  ),
  expenses AS (
    SELECT e.date, SUM(e.amount) AS total_expenses
    FROM polla_org_expenses e
    WHERE e.polla_organization_id = p_organization_id
      AND e.date BETWEEN p_from AND p_to
      AND (p_group_id IS NULL OR e.polla_group_id = p_group_id)
      -- Los gastos son de la organización, no de un pasador.
      AND p_user_id IS NULL
    GROUP BY e.date
  )
  SELECT
    a.date,
    a.accounts_count,
    a.total_pass,
    a.total_successes,
    a.total_commission,
    a.total_claims,
    a.total_bills,
    a.total_revenue,
    a.total_subtotal,
    a.total_previous_balance,
    a.total_collections,
    a.total_paid,
    a.total_total,
    COALESCE(x.total_expenses, 0) AS total_expenses,
    a.total_collections - a.total_paid - COALESCE(x.total_expenses, 0) AS net_balance
  FROM accounts a
  LEFT JOIN expenses x ON x.date = a.date
  ORDER BY a.date;
$$;

REVOKE ALL ON FUNCTION polla_current_account_daily_totals(UUID, DATE, DATE, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_current_account_daily_totals(UUID, DATE, DATE, UUID, UUID) TO service_role;
