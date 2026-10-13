-- Polla: cuenta corriente acumulada por período (liquidación semanal).
--
-- La mayoría de los pasadores se liquida por semana: lo jugado en los días se
-- suma al pase y el pase al subtotal hasta que se liquida. A algunos se los
-- liquida antes (hubo un cobro o un pago) y eso queda asentado ese día.
--
-- Las filas diarias de polla_current_accounts no cambian: el saldo (`total`) ya
-- se arrastra día a día y los reportes por rango suman días. El período se arma
-- al leer: para un pasador a la fecha D son sus filas desde el día siguiente a
-- su última liquidación anterior a D hasta D.
--
-- * polla_current_account_period_rows: la fila de D de cada pasador con los
--   montos de su período (`period`).
-- * polla_recalculate_open_period: "Actualizar" recalcula todos los días del
--   período abierto, no solo D. Así entran los días que nunca se calcularon
--   (por ejemplo, un domingo sin sorteo con tickets vendidos).

CREATE INDEX IF NOT EXISTS idx_polla_current_accounts_liquidated
  ON polla_current_accounts (polla_user_id, date)
  WHERE is_liquidated;

-- ============================================================
-- 1. Filas de un día con los montos del período
-- ============================================================

DROP FUNCTION IF EXISTS polla_current_account_period_rows(UUID, DATE, UUID, UUID, INTEGER);

CREATE FUNCTION polla_current_account_period_rows(
  p_organization_id UUID,
  p_date DATE,
  p_group_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_user_number INTEGER DEFAULT NULL
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
    GROUP BY d.polla_user_id
  ),
  period AS (
    SELECT
      d.polla_user_id,
      MIN(ca.date) AS period_from,
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
     AND (l.liquidated_on IS NULL OR ca.date > l.liquidated_on)
    GROUP BY d.polla_user_id
  )
  SELECT to_jsonb(d.*) || jsonb_build_object(
    'period', jsonb_build_object(
      'from', p.period_from,
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

REVOKE ALL ON FUNCTION polla_current_account_period_rows(UUID, DATE, UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_current_account_period_rows(UUID, DATE, UUID, UUID, INTEGER) TO service_role;

-- ============================================================
-- 2. Recalcular el período abierto ("Actualizar" y liquidar)
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
  -- primera jugada.
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
          AND b.deleted_at IS NULL
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

  -- Solo los días con movimiento (jugadas cargadas o ganadoras) más D: un día
  -- sin jugadas no cambia nada y la cascada arrastra el saldo igual.
  FOR v_day IN
    SELECT days.d
    FROM (
      SELECT b.load_date AS d
      FROM polla_bets b
      WHERE b.polla_organization_id = p_organization_id
        AND b.deleted_at IS NULL
        AND b.load_date BETWEEN v_from AND p_date
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
