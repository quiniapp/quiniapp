-- Polla: jugadas borradas en el pase, cuenta corriente por rango y carga de
-- ADMIN+ hasta el último día de juego.
--
-- * El pasador borra lo suyo y lo de sus jugadores hasta el cierre de carga,
--   aunque su cuenta ya se haya liquidado (antes: POLLA_BET_DELETE_LIQUIDATED).
--   Lo liquidado no cambia: la jugada sigue contando en el pase de su día de
--   carga y se descuenta el día que se borra (`deducted_on`). Si ese día la
--   cuenta del pasador ya se liquidó, se descuenta al día siguiente.
-- * La cuenta corriente guarda el pase de jugadas (`bets_pass`, todo lo
--   cargado ese día) y las borradas (`deleted_pass`, lo descontado ese día).
--   `pass` = bets_pass - deleted_pass + reclamos positivos, como hasta ahora,
--   y la comisión se calcula sobre ese pase. El día de una baja el pase y la
--   comisión pueden quedar negativos: se revierte lo que ya se liquidó.
-- * Las bajas anteriores a esta migración y las jugadas que anula el borrado
--   de una edición quedan con `deducted_on` NULL: siguen fuera de la cuenta
--   corriente, como hasta ahora.
-- * polla_current_account_period_rows acepta un rango explícito (`p_from`):
--   la liquidación por rango suma exactamente esos días.
-- * ADMIN+ carga hasta el último día de juego de la edición (`end_date`), sin
--   mirar el cierre de carga. Con la polla en juego, los aciertos de los
--   sorteos ya procesados se suman volviendo a generar los ganadores de esos
--   días a mano.

-- ============================================================
-- 1. Columnas
-- ============================================================

ALTER TABLE polla_bets
  ADD COLUMN IF NOT EXISTS deducted_on DATE;

COMMENT ON COLUMN polla_bets.deducted_on IS
  'Día en que la baja de la jugada se descuenta del pase del pasador (Borradas). NULL: activa, o anulada sin pasar por la cuenta corriente.';

ALTER TABLE polla_current_accounts
  ADD COLUMN IF NOT EXISTS bets_pass NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_pass NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN polla_current_accounts.bets_pass IS
  'Pase de jugadas: lo cargado ese día, incluidas las que se borraron después.';
COMMENT ON COLUMN polla_current_accounts.deleted_pass IS
  'Borradas: jugadas que se descuentan del pase ese día.';

-- Hasta ahora el pase era lo cargado más los reclamos positivos.
UPDATE polla_current_accounts
SET bets_pass = pass - GREATEST(claims, 0)
WHERE bets_pass IS DISTINCT FROM pass - GREATEST(claims, 0);

-- Bajas por día (cálculo masivo) y por pasador (recálculo de una fila).
CREATE INDEX IF NOT EXISTS idx_polla_bets_org_deducted_on
  ON polla_bets (polla_organization_id, deducted_on)
  WHERE deducted_on IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_polla_bets_cashier_deducted_on
  ON polla_bets (cashier_polla_user_id, deducted_on)
  WHERE deducted_on IS NOT NULL;

-- ============================================================
-- 2. Cuenta corriente: cálculo masivo del día
--    Igual que en 20260928100400; cambia cómo se arma el pase.
-- ============================================================

DROP FUNCTION IF EXISTS polla_calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID, BOOLEAN);

CREATE FUNCTION polla_calculate_current_account(
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
DECLARE
  v_date DATE := to_date(p_date_text, 'DD-MM-YYYY');
  result_array JSONB[];
BEGIN
  IF p_organization_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('polla:' || p_organization_id::text || ':' || p_date_text));
  END IF;

  WITH
  daily_activity AS (
    SELECT
      a.polla_user_id,
      SUM(a.bets_pass) AS bets_pass,
      SUM(a.deleted_pass) AS deleted_pass,
      SUM(a.successes) AS successes
    FROM (
      -- Cargadas el día y activas.
      SELECT b.cashier_polla_user_id AS polla_user_id,
             b.amount AS bets_pass,
             0::NUMERIC AS deleted_pass,
             0::NUMERIC AS successes
      FROM polla_bets b
      WHERE b.load_date = v_date
        AND b.deleted_at IS NULL
        AND (p_organization_id IS NULL OR b.polla_organization_id = p_organization_id)
      UNION ALL
      -- Cargadas el día y borradas después: siguen en el pase de su día.
      SELECT b.cashier_polla_user_id, b.amount, 0, 0
      FROM polla_bets b
      WHERE b.deducted_on IS NOT NULL
        AND b.load_date = v_date
        AND (p_organization_id IS NULL OR b.polla_organization_id = p_organization_id)
      UNION ALL
      -- Borradas que se descuentan el día.
      SELECT b.cashier_polla_user_id, 0, b.amount, 0
      FROM polla_bets b
      WHERE b.deducted_on = v_date
        AND (p_organization_id IS NULL OR b.polla_organization_id = p_organization_id)
      UNION ALL
      -- Premios del día.
      SELECT b.cashier_polla_user_id, 0, 0, b.prize
      FROM polla_bets b
      WHERE b.winner
        AND b.hit_date = v_date
        AND b.deleted_at IS NULL
        AND (p_organization_id IS NULL OR b.polla_organization_id = p_organization_id)
    ) a
    GROUP BY a.polla_user_id
  ),
  previous_state AS (
    SELECT DISTINCT ON (ca.polla_user_id)
      ca.polla_user_id,
      ca.total AS previous_balance,
      ca.drag AS previous_drag_raw,
      ca.leave AS previous_leave,
      ca.bills AS previous_bills,
      ca.is_liquidated AS previous_is_liquidated
    FROM polla_current_accounts ca
    WHERE ca.date < v_date
      AND (p_organization_id IS NULL OR ca.polla_organization_id = p_organization_id)
    ORDER BY ca.polla_user_id, ca.date DESC
  ),
  existing_day AS (
    SELECT
      ca.polla_user_id,
      COALESCE(ca.claims, 0) AS claims,
      COALESCE(ca.collections, 0) AS collections,
      COALESCE(ca.paid, 0) AS paid,
      COALESCE(ca.leave, 0) AS leave,
      COALESCE(ca.previous_balance, 0) AS previous_balance_today,
      COALESCE(ca.previous_drag, 0) AS previous_drag_today
    FROM polla_current_accounts ca
    WHERE ca.date = v_date
      AND (p_organization_id IS NULL OR ca.polla_organization_id = p_organization_id)
  ),
  calculated_data AS (
    SELECT
      u.polla_user_id,
      u.name AS user_name,
      u.number AS user_number,
      u.polla_organization_id,
      u.polla_group_id,
      COALESCE(da.bets_pass, 0) AS bets_pass,
      COALESCE(da.deleted_pass, 0) AS deleted_pass,
      COALESCE(da.bets_pass, 0) - COALESCE(da.deleted_pass, 0) AS pass_raw,
      COALESCE(da.successes, 0) AS successes,
      COALESCE(ed.claims, 0) AS claims,
      COALESCE(ed.collections, 0) AS collections,
      COALESCE(ed.paid, 0) AS paid,
      COALESCE(ed.leave, 0) AS leave_manual,
      COALESCE(ed.previous_balance_today, ps.previous_balance, 0) AS prev_balance_chosen,
      COALESCE(u.fee, 0) / 100.0 AS fee_pct,
      COALESCE(u.fee_plus, 0) / 100.0 AS fee_plus_pct,
      CASE
        WHEN COALESCE(u.fee_plus, 0) <= 0 THEN 0
        ELSE COALESCE(
          ed.previous_drag_today,
          CASE
            WHEN COALESCE(ps.previous_is_liquidated, FALSE) = TRUE AND COALESCE(ps.previous_leave, 0) > 0 THEN 0
            ELSE COALESCE(ps.previous_drag_raw, 0)
          END,
          0
        )
      END AS prev_drag_eff_chosen,
      COALESCE(ps.previous_bills, 0) AS bills
    FROM polla_users u
    LEFT JOIN daily_activity da ON u.polla_user_id = da.polla_user_id
    LEFT JOIN previous_state ps ON u.polla_user_id = ps.polla_user_id
    LEFT JOIN existing_day ed ON u.polla_user_id = ed.polla_user_id
    WHERE u.user_type = 'CASHIER'
      AND u.deleted_at IS NULL
      AND (p_organization_id IS NULL OR u.polla_organization_id = p_organization_id)
  ),
  final_data AS (
    SELECT
      cd.*,
      (cd.pass_raw + GREATEST(cd.claims, 0)) AS pass,
      ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2) AS cashier_commission,
      ((cd.pass_raw + GREATEST(cd.claims, 0))
        - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
        - cd.successes
        + LEAST(cd.claims, 0)) AS revenue
    FROM calculated_data cd
  ),
  resolved AS (
    SELECT
      fd.*,
      fd.revenue AS subtotal,
      CASE WHEN fd.fee_plus_pct <= 0 THEN 0 ELSE fd.prev_drag_eff_chosen + fd.revenue END AS drag_calc,
      CASE
        WHEN fd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave THEN
          CASE
            WHEN (fd.prev_drag_eff_chosen + fd.revenue) > 0
              THEN ROUND((fd.prev_drag_eff_chosen + fd.revenue) * fd.fee_plus_pct, 2)
            ELSE 0
          END
        ELSE COALESCE(fd.leave_manual, 0)
      END AS leave_effective
    FROM final_data fd
  ),
  stored AS (
    SELECT
      r.*,
      CASE
        WHEN r.fee_plus_pct <= 0 THEN r.subtotal
        WHEN p_leave_in_subtotal AND p_calculate_leave AND r.leave_effective > 0
          THEN r.subtotal - r.leave_effective
        ELSE r.subtotal
      END AS subtotal_to_store,
      (r.prev_balance_chosen + r.revenue - r.collections + r.paid - r.leave_effective) AS total_final,
      CASE WHEN r.fee_plus_pct <= 0 THEN 0 ELSE r.prev_drag_eff_chosen END AS previous_drag_to_store
    FROM resolved r
  ),
  upserted_rows AS (
    INSERT INTO polla_current_accounts (
      polla_current_account_id,
      polla_user_id, user_name, user_number,
      polla_organization_id, polla_group_id,
      bets_pass, deleted_pass,
      pass, successes, claims,
      subtotal, previous_balance, collections, paid,
      total, drag, leave, date,
      created_at, edited_at,
      cashier_commission, bills, revenue, previous_drag,
      is_liquidated
    )
    SELECT
      gen_random_uuid(),
      s.polla_user_id, s.user_name, s.user_number,
      s.polla_organization_id, s.polla_group_id,
      s.bets_pass, s.deleted_pass,
      s.pass, s.successes, s.claims,
      s.subtotal_to_store, s.prev_balance_chosen, s.collections, s.paid,
      s.total_final, s.drag_calc, s.leave_effective, v_date,
      NOW(), NOW(),
      s.cashier_commission, s.bills, s.revenue, s.previous_drag_to_store,
      CASE WHEN p_liquidated THEN TRUE ELSE FALSE END
    FROM stored s
    ON CONFLICT (polla_user_id, date) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      user_number = EXCLUDED.user_number,
      polla_group_id = EXCLUDED.polla_group_id,
      bets_pass = EXCLUDED.bets_pass,
      deleted_pass = EXCLUDED.deleted_pass,
      pass = EXCLUDED.pass,
      successes = EXCLUDED.successes,
      claims = polla_current_accounts.claims,
      collections = polla_current_accounts.collections,
      paid = polla_current_accounts.paid,
      leave = CASE
                WHEN p_calculate_leave THEN EXCLUDED.leave
                ELSE polla_current_accounts.leave
              END,
      subtotal = EXCLUDED.subtotal,
      previous_balance = polla_current_accounts.previous_balance,
      total = EXCLUDED.total,
      drag = EXCLUDED.drag,
      edited_at = NOW(),
      cashier_commission = EXCLUDED.cashier_commission,
      bills = EXCLUDED.bills,
      revenue = EXCLUDED.revenue,
      previous_drag = polla_current_accounts.previous_drag,
      is_liquidated = CASE
                        WHEN p_liquidated THEN TRUE
                        ELSE polla_current_accounts.is_liquidated
                      END
    RETURNING TO_JSONB(polla_current_accounts.*) AS json_row
  )
  SELECT COALESCE(array_agg(upserted_rows.json_row), '{}'::JSONB[])
  INTO result_array
  FROM upserted_rows;

  RETURN result_array;
END;
$$;

ALTER FUNCTION polla_calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID, BOOLEAN)
  SET statement_timeout = '300000';

REVOKE ALL ON FUNCTION polla_calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID, BOOLEAN) TO service_role;

-- ============================================================
-- 3. Cuenta corriente: recálculo de una sola fila
--    Igual que en 20260928100400; cambia cómo se arma el pase.
-- ============================================================

DROP FUNCTION IF EXISTS polla_update_current_account_recompute(UUID, JSONB, BOOLEAN, UUID, BOOLEAN);

CREATE FUNCTION polla_update_current_account_recompute(
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
DECLARE
  cur polla_current_accounts;
  v_user_id UUID;
  v_date DATE;
  row_count INTEGER;
  v_bets_pass NUMERIC := 0;
  v_deleted_pass NUMERIC := 0;
  v_pass_raw NUMERIC := 0;
  v_successes NUMERIC := 0;
  v_fee_pct NUMERIC := 0;
  v_fee_plus_pct NUMERIC := 0;
  v_prev_total NUMERIC := 0;
  v_prev_drag_raw NUMERIC := 0;
  v_prev_leave NUMERIC := 0;
  v_prev_bills NUMERIC := 0;
  v_prev_drag NUMERIC := 0;
  eff_claims NUMERIC := 0;
  eff_collections NUMERIC := 0;
  eff_paid NUMERIC := 0;
  eff_bills NUMERIC := 0;
  claims_pos NUMERIC := 0;
  claims_neg NUMERIC := 0;
  v_pass NUMERIC := 0;
  v_comm NUMERIC := 0;
  v_subtotal NUMERIC := 0;
  v_revenue NUMERIC := 0;
  v_total NUMERIC := 0;
  v_drag NUMERIC := 0;
  v_leave NUMERIC := 0;
  has_claims BOOLEAN := p_props ? 'claims';
  has_collections BOOLEAN := p_props ? 'collections';
  has_paid BOOLEAN := p_props ? 'paid';
  has_bills BOOLEAN := p_props ? 'bills';
  has_previous_balance BOOLEAN := p_props ? 'previous_balance';
  has_previous_drag BOOLEAN := p_props ? 'previous_drag';
BEGIN
  SELECT * INTO cur
  FROM polla_current_accounts
  WHERE polla_current_account_id = p_polla_current_account_id
    AND polla_organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_CURRENT_ACCOUNT_NOT_FOUND';
  END IF;

  v_user_id := cur.polla_user_id;
  v_date := cur.date;

  -- Pase de jugadas: lo cargado el día, aunque se haya borrado después.
  -- Borradas: lo que se descuenta el día. Premios: ganadoras del día.
  SELECT
    COALESCE(SUM(b.amount) FILTER (
      WHERE b.load_date = v_date AND (b.deleted_at IS NULL OR b.deducted_on IS NOT NULL)
    ), 0),
    COALESCE(SUM(b.amount) FILTER (WHERE b.deducted_on = v_date), 0),
    COALESCE(SUM(b.prize) FILTER (
      WHERE b.winner AND b.hit_date = v_date AND b.deleted_at IS NULL
    ), 0)
  INTO v_bets_pass, v_deleted_pass, v_successes
  FROM polla_bets b
  WHERE b.cashier_polla_user_id = v_user_id
    AND b.polla_organization_id = p_organization_id
    AND (b.load_date = v_date OR b.deducted_on = v_date OR (b.winner AND b.hit_date = v_date));

  v_pass_raw := v_bets_pass - v_deleted_pass;

  SELECT
    COALESCE(u.fee, 0) / 100.0,
    COALESCE(u.fee_plus, 0) / 100.0
  INTO v_fee_pct, v_fee_plus_pct
  FROM polla_users u
  WHERE u.polla_user_id = v_user_id
    AND u.deleted_at IS NULL
    AND u.polla_organization_id = p_organization_id;

  SELECT
    COALESCE(ca.total, 0),
    COALESCE(ca.drag, 0),
    COALESCE(ca.leave, 0),
    COALESCE(ca.bills, 0)
  INTO v_prev_total, v_prev_drag_raw, v_prev_leave, v_prev_bills
  FROM polla_current_accounts ca
  WHERE ca.polla_user_id = v_user_id
    AND ca.date < v_date
    AND ca.polla_organization_id = p_organization_id
  ORDER BY ca.date DESC
  LIMIT 1;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count = 0 THEN
    v_prev_total := 0;
    v_prev_drag_raw := 0;
    v_prev_leave := 0;
    v_prev_bills := 0;
  END IF;

  IF has_previous_balance THEN
    v_prev_total := (p_props->>'previous_balance')::NUMERIC;
  END IF;

  IF has_previous_drag THEN
    v_prev_drag_raw := (p_props->>'previous_drag')::NUMERIC;
    v_prev_leave := 0;
  END IF;

  v_prev_drag := CASE
    WHEN v_prev_leave > 0 AND v_prev_drag_raw > 0 THEN 0
    ELSE v_prev_drag_raw
  END;

  eff_claims := COALESCE((CASE WHEN has_claims THEN (p_props->>'claims')::NUMERIC END), cur.claims, 0);
  eff_collections := COALESCE((CASE WHEN has_collections THEN (p_props->>'collections')::NUMERIC END), cur.collections, 0);
  eff_paid := COALESCE((CASE WHEN has_paid THEN (p_props->>'paid')::NUMERIC END), cur.paid, 0);
  eff_bills := COALESCE((CASE WHEN has_bills THEN (p_props->>'bills')::NUMERIC END), v_prev_bills);

  claims_pos := GREATEST(eff_claims, 0);
  claims_neg := LEAST(eff_claims, 0);
  v_pass := v_pass_raw + claims_pos;
  v_comm := ROUND(v_pass * v_fee_pct, 2);
  v_subtotal := v_pass - v_comm - v_successes + claims_neg;
  v_revenue := v_subtotal;
  v_total := v_prev_total + v_revenue - eff_collections + eff_paid;

  IF v_fee_plus_pct > 0 THEN
    v_drag := v_prev_drag + v_revenue;
    IF p_calculate_leave THEN
      IF v_drag > 0 THEN
        v_leave := ROUND(v_drag * v_fee_plus_pct, 2);
        v_total := v_total - v_leave;
        IF p_leave_in_subtotal THEN
          v_subtotal := v_revenue - v_leave;
        END IF;
      ELSE
        v_leave := 0;
      END IF;
    ELSE
      v_leave := COALESCE(cur.leave, 0);
    END IF;
  ELSE
    v_prev_drag := 0;
    v_drag := 0;
    v_leave := 0;
  END IF;

  UPDATE polla_current_accounts ca
  SET
    claims = eff_claims,
    collections = eff_collections,
    paid = eff_paid,
    bills = eff_bills,
    bets_pass = v_bets_pass,
    deleted_pass = v_deleted_pass,
    pass = v_pass,
    successes = v_successes,
    cashier_commission = v_comm,
    subtotal = v_subtotal,
    revenue = v_revenue,
    previous_balance = v_prev_total,
    previous_drag = v_prev_drag,
    total = v_total,
    drag = v_drag,
    leave = v_leave,
    edited_at = NOW()
  WHERE ca.polla_current_account_id = p_polla_current_account_id
    AND ca.polla_organization_id = p_organization_id
  RETURNING * INTO cur;

  RETURN cur;
END;
$$;

REVOKE ALL ON FUNCTION polla_update_current_account_recompute(UUID, JSONB, BOOLEAN, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_update_current_account_recompute(UUID, JSONB, BOOLEAN, UUID, BOOLEAN) TO service_role;

-- ============================================================
-- 4. Filas de un día con los montos del período o de un rango
--    Igual que en 20261012210906, más `p_from` y el pase de jugadas y las
--    borradas. Sin `p_from`, el período de cada pasador arranca el día
--    siguiente a su última liquidación; con `p_from`, es [p_from, p_date].
--    En los dos casos el saldo anterior es el del primer día, así que
--    saldo anterior + subtotal - cobros + pagos = total del último día.
-- ============================================================

DROP FUNCTION IF EXISTS polla_current_account_period_rows(UUID, DATE, UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS polla_current_account_period_rows(UUID, DATE, UUID, UUID, INTEGER, DATE);

CREATE FUNCTION polla_current_account_period_rows(
  p_organization_id UUID,
  p_date DATE,
  p_group_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_user_number INTEGER DEFAULT NULL,
  p_from DATE DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH day_rows AS (
    SELECT ca.*
    FROM polla_current_accounts ca
    WHERE ca.polla_organization_id = p_organization_id
      AND ca.date = p_date
      AND (p_group_id IS NULL OR ca.polla_group_id = p_group_id)
      AND (p_user_id IS NULL OR ca.polla_user_id = p_user_id)
      AND (p_user_number IS NULL OR ca.user_number = p_user_number)
  ),
  last_liquidation AS (
    SELECT d.polla_user_id, MAX(ca.date) AS liquidated_on
    FROM day_rows d
    JOIN polla_current_accounts ca
      ON ca.polla_user_id = d.polla_user_id
     AND ca.is_liquidated
     AND ca.date < p_date
    WHERE p_from IS NULL
    GROUP BY d.polla_user_id
  ),
  period AS (
    SELECT
      d.polla_user_id,
      COALESCE(p_from, MIN(ca.date)) AS period_from,
      SUM(ca.bets_pass) AS bets_pass,
      SUM(ca.deleted_pass) AS deleted_pass,
      SUM(ca.pass) AS pass,
      SUM(ca.successes) AS successes,
      SUM(ca.claims) AS claims,
      SUM(ca.cashier_commission) AS cashier_commission,
      SUM(ca.revenue) AS revenue,
      SUM(ca.subtotal) AS subtotal,
      SUM(ca.collections) AS collections,
      SUM(ca.paid) AS paid,
      -- Saldo con el que arrancó el período: el que traía su primer día.
      (ARRAY_AGG(ca.previous_balance ORDER BY ca.date))[1] AS previous_balance
    FROM day_rows d
    LEFT JOIN last_liquidation l ON l.polla_user_id = d.polla_user_id
    JOIN polla_current_accounts ca
      ON ca.polla_user_id = d.polla_user_id
     AND ca.polla_organization_id = p_organization_id
     AND ca.date <= p_date
     AND (
       CASE
         WHEN p_from IS NOT NULL THEN ca.date >= p_from
         ELSE l.liquidated_on IS NULL OR ca.date > l.liquidated_on
       END
     )
    GROUP BY d.polla_user_id
  )
  SELECT to_jsonb(d.*) || jsonb_build_object(
    'period', jsonb_build_object(
      'from', p.period_from,
      'bets_pass', p.bets_pass,
      'deleted_pass', p.deleted_pass,
      'pass', p.pass,
      'successes', p.successes,
      'claims', p.claims,
      'cashier_commission', p.cashier_commission,
      'revenue', p.revenue,
      'subtotal', p.subtotal,
      'previous_balance', p.previous_balance,
      'collections', p.collections,
      'paid', p.paid,
      'total', d.total
    )
  )
  FROM day_rows d
  JOIN period p ON p.polla_user_id = d.polla_user_id
  ORDER BY d.user_number NULLS LAST, d.user_name;
$$;

REVOKE ALL ON FUNCTION polla_current_account_period_rows(UUID, DATE, UUID, UUID, INTEGER, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_current_account_period_rows(UUID, DATE, UUID, UUID, INTEGER, DATE) TO service_role;

-- ============================================================
-- 5. Recalcular el período abierto
--    Igual que en 20261012210906; los días con bajas también cuentan.
-- ============================================================

DROP FUNCTION IF EXISTS polla_recalculate_open_period(UUID, DATE);

CREATE FUNCTION polla_recalculate_open_period(
  p_organization_id UUID,
  p_date DATE
)
RETURNS DATE
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_from DATE;
  v_first DATE;
  v_day DATE;
BEGIN
  -- El período abierto más viejo entre los pasadores de la organización: desde
  -- el día siguiente a su última liquidación o, si nunca se liquidó, desde su
  -- primera jugada (las borradas que pasaron por la cuenta también cuentan).
  SELECT MIN(s.start) INTO v_from
  FROM (
    SELECT COALESCE(
      (
        SELECT MAX(ca.date) + 1
        FROM polla_current_accounts ca
        WHERE ca.polla_user_id = u.polla_user_id
          AND ca.is_liquidated
          AND ca.date < p_date
      ),
      (
        SELECT MIN(b.load_date)
        FROM polla_bets b
        WHERE b.cashier_polla_user_id = u.polla_user_id
          AND (b.deleted_at IS NULL OR b.deducted_on IS NOT NULL)
      ),
      p_date
    ) AS start
    FROM polla_users u
    WHERE u.polla_organization_id = p_organization_id
      AND u.user_type = 'CASHIER'
      AND u.deleted_at IS NULL
  ) s;

  -- Tope de 62 días hacia atrás (POLLA_ACCOUNT_RECALC_MAX_DAYS en helper/polla).
  v_from := LEAST(GREATEST(COALESCE(v_from, p_date), p_date - 62), p_date);

  -- Solo los días con movimiento (jugadas cargadas, borradas o ganadoras) más
  -- D: un día sin jugadas no cambia nada y la cascada arrastra el saldo igual.
  FOR v_day IN
    SELECT days.d
    FROM (
      SELECT b.load_date AS d
      FROM polla_bets b
      WHERE b.polla_organization_id = p_organization_id
        AND (b.deleted_at IS NULL OR b.deducted_on IS NOT NULL)
        AND b.load_date BETWEEN v_from AND p_date
      UNION
      SELECT b.deducted_on
      FROM polla_bets b
      WHERE b.polla_organization_id = p_organization_id
        AND b.deducted_on BETWEEN v_from AND p_date
      UNION
      SELECT b.hit_date
      FROM polla_bets b
      WHERE b.polla_organization_id = p_organization_id
        AND b.deleted_at IS NULL
        AND b.winner
        AND b.hit_date BETWEEN v_from AND p_date
      UNION
      SELECT p_date
    ) days
    ORDER BY days.d
  LOOP
    IF v_first IS NULL THEN
      v_first := v_day;
    END IF;

    PERFORM polla_calculate_current_account(
      to_char(v_day, 'DD-MM-YYYY'),
      FALSE,
      FALSE,
      p_organization_id
    );
  END LOOP;

  -- El cálculo conserva el saldo anterior de las filas que ya existían: la
  -- cascada lo vuelve a encadenar desde el primer día recalculado.
  PERFORM polla_cascade_current_account_from_date(
    to_char(v_first, 'DD-MM-YYYY'),
    p_organization_id
  );

  RETURN v_first;
END;
$$;

ALTER FUNCTION polla_recalculate_open_period(UUID, DATE)
  SET statement_timeout = '300000';

REVOKE ALL ON FUNCTION polla_recalculate_open_period(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_recalculate_open_period(UUID, DATE) TO service_role;

-- ============================================================
-- 6. Totales de la cuenta corriente por día
--    Igual que en 20261006120200, más el pase de jugadas y las borradas.
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

REVOKE ALL ON FUNCTION polla_current_account_daily_totals(UUID, DATE, DATE, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_current_account_daily_totals(UUID, DATE, DATE, UUID, UUID) TO service_role;

-- ============================================================
-- 7. Baja de una jugada: se descuenta del pase el día que se borra
-- ============================================================

DROP FUNCTION IF EXISTS polla_delete_bet(UUID, UUID, BOOLEAN);

CREATE FUNCTION polla_delete_bet(
  p_bet_id UUID,
  p_actor_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bet polla_bets;
  v_edition polla_editions;
  v_deducted_on DATE;
BEGIN
  SELECT * INTO v_bet
  FROM polla_bets
  WHERE polla_bet_id = p_bet_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_BET_NOT_FOUND';
  END IF;

  IF v_bet.winner THEN
    RAISE EXCEPTION 'POLLA_BET_ALREADY_WINNER';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = v_bet.polla_edition_id
  FOR UPDATE;

  -- Pasador: hasta el cierre de carga de la edición, aunque ya se haya
  -- liquidado. ADMIN+ (force): en cualquier momento.
  IF NOT p_force AND polla_load_closed(v_edition.load_limit_date, v_edition.load_limit_time) THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  -- La baja se descuenta hoy; si la cuenta del pasador ya se liquidó hoy, al
  -- día siguiente: lo liquidado no cambia. GREATEST ignora el NULL de un
  -- pasador que nunca se liquidó.
  SELECT GREATEST(polla_today(), MAX(ca.date) + 1)
  INTO v_deducted_on
  FROM polla_current_accounts ca
  WHERE ca.polla_user_id = v_bet.cashier_polla_user_id
    AND ca.is_liquidated;

  UPDATE polla_bets
  SET deleted_at = NOW(),
      deleted_by = p_actor_id,
      deducted_on = v_deducted_on
  WHERE polla_bet_id = p_bet_id;

  UPDATE polla_editions
  SET bets_count = GREATEST(bets_count - 1, 0),
      collected_amount = GREATEST(collected_amount - v_bet.amount, 0),
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id;

  -- El día de carga no cambia (la jugada sigue en su pase de jugadas): se
  -- recalcula el día en que se descuenta, si ya estaba calculado.
  PERFORM polla_refresh_current_account_row(
    v_bet.cashier_polla_user_id,
    v_deducted_on,
    v_bet.polla_organization_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'polla_bet_id', p_bet_id,
    'deducted_on', v_deducted_on
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_delete_bet(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_delete_bet(UUID, UUID, BOOLEAN) TO service_role;

-- ============================================================
-- 8. Alta de una jugada: ADMIN+ hasta el último día de juego
--    Igual que en 20261014225307; cambia el corte con p_force.
-- ============================================================

DROP FUNCTION IF EXISTS polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN);

CREATE FUNCTION polla_create_bet(
  p_edition_id UUID,
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_numbers TEXT[],
  p_date DATE DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_date DATE := COALESCE(p_date, polla_today());
  v_edition polla_editions;
  v_target polla_users;
  v_cashier polla_users;
  v_ticket_number TEXT;
  v_bet polla_bets;
  v_attempt INTEGER := 0;
BEGIN
  IF array_length(p_numbers, 1) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_MUST_BE_TEN';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF v_edition.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_ACTIVE';
  END IF;

  -- Pasador y jugador: hasta la fecha y hora de cierre. ADMIN+ (p_force): sin
  -- cierre de carga, hasta el último día de juego. Los aciertos de los sorteos
  -- ya procesados no se suman solos: el admin vuelve a generar los ganadores
  -- de esos días.
  IF p_force THEN
    IF polla_today() > v_edition.end_date THEN
      RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
    END IF;
  ELSIF polla_load_closed(v_edition.load_limit_date, v_edition.load_limit_time) THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  SELECT * INTO v_target
  FROM polla_users
  WHERE polla_user_id = p_target_user_id
    AND deleted_at IS NULL
    AND disabled = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  IF v_target.polla_organization_id <> v_edition.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_USER_OTHER_ORGANIZATION';
  END IF;

  IF v_target.user_type NOT IN ('PLAYER', 'CASHIER') THEN
    RAISE EXCEPTION 'POLLA_USER_CANNOT_BET';
  END IF;

  IF v_target.user_type = 'PLAYER' THEN
    SELECT * INTO v_cashier
    FROM polla_users
    WHERE polla_user_id = v_target.parent_polla_user_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POLLA_PARENT_NOT_FOUND';
    END IF;
  ELSE
    v_cashier := v_target;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_ticket_number := to_char(
                         clock_timestamp() AT TIME ZONE 'America/Argentina/Buenos_Aires',
                         'YYYYMMDDHH24MISSMS'
                       )
                       || '-'
                       || COALESCE(v_cashier.number, (floor(random() * 1000))::INTEGER);

    BEGIN
      INSERT INTO polla_bets (
        ticket_number,
        polla_edition_id,
        polla_user_id,
        cashier_polla_user_id,
        polla_organization_id,
        polla_group_id,
        user_name,
        cashier_name,
        cashier_number,
        load_date,
        amount,
        numbers,
        created_by
      ) VALUES (
        v_ticket_number,
        v_edition.polla_edition_id,
        v_target.polla_user_id,
        v_cashier.polla_user_id,
        v_edition.polla_organization_id,
        v_cashier.polla_group_id,
        v_target.name,
        v_cashier.name,
        v_cashier.number,
        v_date,
        v_edition.ticket_price,
        p_numbers,
        p_actor_user_id
      )
      RETURNING * INTO v_bet;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN
        RAISE EXCEPTION 'POLLA_TICKET_NUMBER_COLLISION';
      END IF;
      PERFORM pg_sleep(0.005);
    END;
  END LOOP;

  UPDATE polla_editions
  SET bets_count = bets_count + 1,
      collected_amount = collected_amount + v_edition.ticket_price,
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id;

  PERFORM polla_refresh_current_account_row(
    v_bet.cashier_polla_user_id,
    v_bet.load_date,
    v_bet.polla_organization_id
  );

  RETURN jsonb_build_object('success', true, 'bet', to_jsonb(v_bet));
END;
$$;

REVOKE ALL ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN) TO service_role;
