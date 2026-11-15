-- Cuenta corriente por edición: tablas, corte de la migración y fin del
-- recálculo por días.
--
-- * `polla_edition_account_movements`: cobros, pagos y reclamos de un pasador
--   en una edición.
-- * `polla_edition_liquidations`: foto de cada liquidación de un pasador (la
--   fila más nueva de cada par edición/pasador es la vigente).
-- * `polla_group_edition_accounts`: cuenta del grupo por edición.
-- * `polla_org_expenses.polla_edition_id`: gastos por edición.
-- * Corte: las ediciones que ya terminaron y están liquidadas por días siguen
--   por días (solo consulta); el resto pasa a liquidarse por edición.
-- * La cuenta por días queda solo para consultar: procesar resultados y cargar,
--   borrar o anular tickets ya no la tocan, y las funciones que la escribían
--   (también la liquidación de grupo por fecha) responden
--   POLLA_DAILY_ACCOUNT_READ_ONLY.
-- * El historial por fechas deja afuera los gastos por edición.

-- ============================================================
-- 1. Edición: marca de cuenta por edición y de liquidada
-- ============================================================

ALTER TABLE polla_editions
  ADD COLUMN account_by_edition BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN liquidated_at TIMESTAMPTZ,
  ADD COLUMN liquidated_by UUID REFERENCES polla_users(polla_user_id);

COMMENT ON COLUMN polla_editions.account_by_edition IS
  'TRUE: la cuenta corriente se lleva por edición. FALSE: quedó liquidada por días y solo se consulta.';

-- ============================================================
-- 2. Movimientos de la cuenta por edición
-- ============================================================

CREATE TYPE polla_account_movement_type_enum AS ENUM ('COLLECTION', 'PAYMENT', 'CLAIM');

CREATE TABLE polla_edition_account_movements (
  polla_edition_account_movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  polla_edition_id UUID NOT NULL REFERENCES polla_editions(polla_edition_id),
  -- El pasador.
  polla_user_id UUID NOT NULL REFERENCES polla_users(polla_user_id),
  type polla_account_movement_type_enum NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT polla_today(),
  note TEXT,
  created_by UUID REFERENCES polla_users(polla_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_by UUID REFERENCES polla_users(polla_user_id),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES polla_users(polla_user_id),
  -- Un reclamo puede ser negativo; cobros y pagos son siempre positivos.
  CONSTRAINT polla_edition_account_movements_amount_check
    CHECK (amount <> 0 AND (type = 'CLAIM' OR amount > 0))
);

CREATE INDEX idx_polla_edition_account_movements_edition_user
  ON polla_edition_account_movements (polla_edition_id, polla_user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE polla_edition_account_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE polla_edition_account_movements FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE polla_edition_account_movements TO service_role;

-- ============================================================
-- 3. Liquidaciones de un pasador en una edición
-- ============================================================

CREATE TABLE polla_edition_liquidations (
  polla_edition_liquidation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  polla_edition_id UUID NOT NULL REFERENCES polla_editions(polla_edition_id),
  polla_user_id UUID NOT NULL REFERENCES polla_users(polla_user_id),
  user_name TEXT NOT NULL,
  user_number INTEGER,
  -- El grupo del pasador al liquidar.
  polla_group_id UUID REFERENCES polla_groups(polla_group_id),
  fee NUMERIC(5,2),
  bets_pass NUMERIC(12,2) NOT NULL DEFAULT 0,
  deleted_pass NUMERIC(12,2) NOT NULL DEFAULT 0,
  claims NUMERIC(12,2) NOT NULL DEFAULT 0,
  pass NUMERIC(12,2) NOT NULL DEFAULT 0,
  cashier_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  collections NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  kept_previous_tickets BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES polla_users(polla_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_polla_edition_liquidations_edition_user
  ON polla_edition_liquidations (polla_edition_id, polla_user_id, created_at DESC);

ALTER TABLE polla_edition_liquidations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE polla_edition_liquidations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE polla_edition_liquidations TO service_role;

-- ============================================================
-- 4. Cuenta del grupo por edición
-- ============================================================

CREATE TABLE polla_group_edition_accounts (
  polla_group_edition_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  polla_group_id UUID NOT NULL REFERENCES polla_groups(polla_group_id),
  polla_edition_id UUID NOT NULL REFERENCES polla_editions(polla_edition_id),
  group_name TEXT NOT NULL,
  cashiers_subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  base NUMERIC(12,2) NOT NULL DEFAULT 0,
  admin_percentage NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (admin_percentage BETWEEN 0 AND 100),
  admin_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  adjustments NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES polla_users(polla_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT polla_group_edition_accounts_group_edition_uniq UNIQUE (polla_group_id, polla_edition_id)
);

ALTER TABLE polla_group_edition_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE polla_group_edition_accounts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE polla_group_edition_accounts TO service_role;

-- ============================================================
-- 5. Gastos por edición
-- ============================================================

ALTER TABLE polla_org_expenses
  ADD COLUMN polla_edition_id UUID REFERENCES polla_editions(polla_edition_id);

CREATE INDEX idx_polla_org_expenses_org_edition
  ON polla_org_expenses (polla_organization_id, polla_edition_id);

-- ============================================================
-- 6. Tickets borrados de una edición
-- ============================================================

-- La cuenta por edición suma los borrados con descuento (`deducted_on`) de la
-- edición: sin este índice, el único que los encuentra es el de
-- `deducted_on`, que recorre los borrados de todas las ediciones.
CREATE INDEX IF NOT EXISTS idx_polla_bets_edition_cashier_deducted
  ON polla_bets (polla_edition_id, cashier_polla_user_id)
  WHERE deducted_on IS NOT NULL;

-- ============================================================
-- 7. Corte: qué ediciones quedan por días
-- ============================================================

-- Fecha de la última liquidación por días del pasador (NULL si nunca se liquidó).
CREATE FUNCTION polla_cashier_last_liquidation(p_user_id UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT MAX(date)
  FROM polla_current_accounts
  WHERE polla_user_id = p_user_id
    AND is_liquidated;
$$;

-- TRUE si algún ticket de la edición cuenta en un día que todavía no se
-- liquidó por días: cargado después de la última liquidación de su pasador, o
-- borrado con descuento posterior a esa liquidación.
CREATE FUNCTION polla_edition_has_unliquidated_days(p_edition_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM polla_bets b
    WHERE b.polla_edition_id = p_edition_id
      AND (
        b.load_date > COALESCE(polla_cashier_last_liquidation(b.cashier_polla_user_id), '-infinity'::DATE)
        OR b.deducted_on > COALESCE(polla_cashier_last_liquidation(b.cashier_polla_user_id), '-infinity'::DATE)
      )
  );
$$;

-- Deja por días (account_by_edition = FALSE) las ediciones que terminaron y
-- no tienen días sin liquidar. Devuelve cuántas cambió.
CREATE FUNCTION polla_edition_account_cutover(p_organization_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_changed INTEGER;
BEGIN
  UPDATE polla_editions e
  SET account_by_edition = FALSE
  WHERE e.account_by_edition
    AND e.end_date < polla_today()
    AND (p_organization_id IS NULL OR e.polla_organization_id = p_organization_id)
    AND NOT polla_edition_has_unliquidated_days(e.polla_edition_id);

  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed;
END;
$$;

-- ============================================================
-- 8. Validaciones
-- ============================================================

CREATE FUNCTION polla_validate_edition_account_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_by_edition BOOLEAN;
BEGIN
  SELECT account_by_edition INTO v_by_edition
  FROM polla_editions
  WHERE polla_edition_id = NEW.polla_edition_id
    AND polla_organization_id = NEW.polla_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF NOT v_by_edition THEN
    RAISE EXCEPTION 'POLLA_EDITION_ACCOUNT_DISABLED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM polla_users
    WHERE polla_user_id = NEW.polla_user_id
      AND polla_organization_id = NEW.polla_organization_id
      AND user_type = 'CASHIER'
  ) THEN
    RAISE EXCEPTION 'POLLA_ACCOUNT_USER_NOT_CASHIER';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.edited_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_polla_edition_account_movement_validate
  BEFORE INSERT OR UPDATE ON polla_edition_account_movements
  FOR EACH ROW
  EXECUTE FUNCTION polla_validate_edition_account_movement();

CREATE FUNCTION polla_validate_org_expense_edition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_by_edition BOOLEAN;
BEGIN
  IF NEW.polla_edition_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT account_by_edition INTO v_by_edition
  FROM polla_editions
  WHERE polla_edition_id = NEW.polla_edition_id
    AND polla_organization_id = NEW.polla_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF NOT v_by_edition THEN
    RAISE EXCEPTION 'POLLA_EDITION_ACCOUNT_DISABLED';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_polla_org_expense_edition_validate
  BEFORE INSERT OR UPDATE ON polla_org_expenses
  FOR EACH ROW
  EXECUTE FUNCTION polla_validate_org_expense_edition();

-- ============================================================
-- 9. La cuenta por días queda solo para consultar
-- ============================================================

-- `polla_current_accounts` y `polla_group_accounts` no cambian más. Las
-- funciones conservan su firma (la de su última definición) para que nada que
-- las llame se rompa.

-- Procesar resultados ya no la toca: `polla_process_results_and_accounts` y
-- `polla_define_edition_day` la siguen llamando.
CREATE OR REPLACE FUNCTION polla_recalculate_accounts_on(p_organization_id UUID, p_dates DATE[])
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN 0;
END;
$$;

-- Cargar, borrar o anular tickets tampoco: `polla_create_bet`,
-- `polla_delete_bet`, `polla_delete_unpaid_bets` y `polla_delete_edition` la
-- siguen llamando y no hace nada.
CREATE OR REPLACE FUNCTION polla_refresh_current_account_row(
  p_cashier_id UUID,
  p_date DATE,
  p_organization_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN;
END;
$$;

-- Las que escribían la cuenta por días (calcular un día, recalcular el período
-- abierto, editar una fila, encadenar saldos y liquidar un grupo por fecha)
-- responden POLLA_DAILY_ACCOUNT_READ_ONLY.
CREATE OR REPLACE FUNCTION polla_calculate_current_account(
  p_date_text TEXT,
  p_calculate_leave BOOLEAN DEFAULT FALSE,
  p_liquidated BOOLEAN DEFAULT FALSE,
  p_organization_id UUID DEFAULT NULL,
  p_leave_in_subtotal BOOLEAN DEFAULT FALSE
)
RETURNS JSONB[]
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'POLLA_DAILY_ACCOUNT_READ_ONLY';
END;
$$;

CREATE OR REPLACE FUNCTION polla_recalculate_open_period(p_organization_id UUID, p_date DATE)
RETURNS DATE
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'POLLA_DAILY_ACCOUNT_READ_ONLY';
END;
$$;

CREATE OR REPLACE FUNCTION polla_update_current_account_recompute(
  p_polla_current_account_id UUID,
  p_props JSONB,
  p_calculate_leave BOOLEAN,
  p_organization_id UUID,
  p_leave_in_subtotal BOOLEAN DEFAULT FALSE
)
RETURNS polla_current_accounts
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'POLLA_DAILY_ACCOUNT_READ_ONLY';
END;
$$;

CREATE OR REPLACE FUNCTION polla_cascade_current_account_from_date(
  p_from_date_text TEXT,
  p_organization_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'POLLA_DAILY_ACCOUNT_READ_ONLY';
END;
$$;

CREATE OR REPLACE FUNCTION polla_liquidate_group(
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
BEGIN
  RAISE EXCEPTION 'POLLA_DAILY_ACCOUNT_READ_ONLY';
END;
$$;

-- ============================================================
-- 10. Historial por fechas: sin los gastos por edición
-- ============================================================

-- Un gasto por edición lleva la fecha del día en que se cargó; el historial
-- por fechas suma solo los gastos por fecha (`polla_edition_id IS NULL`).
-- Mismas definiciones que en 20261020212216_polla_deleted_bets_range_admin_load.sql
-- y 20261021233443_polla_group_accounts.sql, más ese filtro.
CREATE OR REPLACE FUNCTION polla_current_account_daily_totals(
  p_organization_id UUID,
  p_from DATE,
  p_to DATE,
  p_group_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  date DATE,
  accounts_count BIGINT,
  total_bets_pass NUMERIC,
  total_deleted_pass NUMERIC,
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
      SUM(ca.bets_pass) AS total_bets_pass,
      SUM(ca.deleted_pass) AS total_deleted_pass,
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
      AND e.polla_edition_id IS NULL
      AND (p_group_id IS NULL OR e.polla_group_id = p_group_id)
      -- Los gastos son de la organización, no de un pasador.
      AND p_user_id IS NULL
    GROUP BY e.date
  )
  SELECT
    a.date,
    a.accounts_count,
    a.total_bets_pass,
    a.total_deleted_pass,
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

CREATE OR REPLACE FUNCTION polla_group_account_preview(
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
    AND e.polla_edition_id IS NULL
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

-- ============================================================
-- 11. Permisos
-- ============================================================

REVOKE ALL ON FUNCTION polla_cashier_last_liquidation(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_cashier_last_liquidation(UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_edition_has_unliquidated_days(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_has_unliquidated_days(UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_edition_account_cutover(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_account_cutover(UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_validate_edition_account_movement() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_validate_edition_account_movement() TO service_role;
REVOKE ALL ON FUNCTION polla_validate_org_expense_edition() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_validate_org_expense_edition() TO service_role;

-- Las que se reemplazan (CREATE OR REPLACE conserva los permisos; se repiten
-- por las dudas).
REVOKE ALL ON FUNCTION polla_recalculate_accounts_on(UUID, DATE[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_recalculate_accounts_on(UUID, DATE[]) TO service_role;
REVOKE ALL ON FUNCTION polla_refresh_current_account_row(UUID, DATE, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_refresh_current_account_row(UUID, DATE, UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID, BOOLEAN) TO service_role;
REVOKE ALL ON FUNCTION polla_recalculate_open_period(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_recalculate_open_period(UUID, DATE) TO service_role;
REVOKE ALL ON FUNCTION polla_update_current_account_recompute(UUID, JSONB, BOOLEAN, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_update_current_account_recompute(UUID, JSONB, BOOLEAN, UUID, BOOLEAN) TO service_role;
REVOKE ALL ON FUNCTION polla_cascade_current_account_from_date(TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_cascade_current_account_from_date(TEXT, UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_liquidate_group(UUID, UUID, DATE, NUMERIC, NUMERIC, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_liquidate_group(UUID, UUID, DATE, NUMERIC, NUMERIC, NUMERIC, UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_current_account_daily_totals(UUID, DATE, DATE, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_current_account_daily_totals(UUID, DATE, DATE, UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_group_account_preview(UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_group_account_preview(UUID, UUID, DATE) TO service_role;

-- Corte único: las ediciones terminadas y liquidadas por días quedan por días.
SELECT polla_edition_account_cutover();

-- ROLLBACK:
-- Orden: primero 20261114150000_polla_group_edition_accounts.sql, después
-- 20261114141228_polla_edition_account_functions.sql y al final esta. Antes de
-- borrar las tablas, exportar los movimientos, las liquidaciones y las cuentas
-- de grupo por edición (y los gastos con `polla_edition_id`): se pierden.
--
-- DROP TRIGGER trg_polla_org_expense_edition_validate ON polla_org_expenses;
-- DROP TRIGGER trg_polla_edition_account_movement_validate ON polla_edition_account_movements;
-- DROP FUNCTION polla_validate_org_expense_edition();
-- DROP FUNCTION polla_validate_edition_account_movement();
-- DROP FUNCTION polla_edition_account_cutover(UUID);
-- DROP FUNCTION polla_edition_has_unliquidated_days(UUID);
-- DROP FUNCTION polla_cashier_last_liquidation(UUID);
-- DROP INDEX idx_polla_bets_edition_cashier_deducted;
-- DROP INDEX idx_polla_org_expenses_org_edition;
-- ALTER TABLE polla_org_expenses DROP COLUMN polla_edition_id;
-- DROP TABLE polla_group_edition_accounts;
-- DROP TABLE polla_edition_liquidations;
-- DROP TABLE polla_edition_account_movements;
-- DROP TYPE polla_account_movement_type_enum;
-- ALTER TABLE polla_editions DROP COLUMN liquidated_by, DROP COLUMN liquidated_at, DROP COLUMN account_by_edition;
--
-- Volver a crear, con la definición del archivo indicado, las funciones que
-- esta migración reemplazó (recalculan y escriben la cuenta por días):
-- * `polla_recalculate_accounts_on`: 20261105090000_polla_edition_draws_min_hits.sql
-- * `polla_refresh_current_account_row`: 20261006120000_polla_bets_without_credits.sql
-- * `polla_calculate_current_account` y `polla_update_current_account_recompute`:
--   20261112054358_polla_liquidated_days_keep_prizes.sql
-- * `polla_recalculate_open_period` y `polla_current_account_daily_totals`:
--   20261020212216_polla_deleted_bets_range_admin_load.sql
-- * `polla_cascade_current_account_from_date`: 20260928100400_polla_functions.sql
-- * `polla_liquidate_group` y `polla_group_account_preview`:
--   20261021233443_polla_group_accounts.sql
-- Las dos de lectura (`polla_current_account_daily_totals` y
-- `polla_group_account_preview`) se vuelven a crear después de borrar la
-- columna `polla_org_expenses.polla_edition_id`, porque la usan.
