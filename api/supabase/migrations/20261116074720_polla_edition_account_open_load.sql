-- Pollas con la carga abierta en "Pollas a liquidar".
--
-- * `polla_edition_account_list`: además de las de carga cerrada, entran las
--   que ya empezaron (`start_date <= hoy`) aunque la carga siga abierta. Cada
--   ítem trae `load_open` para que la web avise y bloquee el liquidar.
-- * `polla_validate_edition_account_movement`: los cobros, pagos y reclamos se
--   cargan también con la carga abierta (se quita el control de
--   20261115210000).
-- * `polla_liquidate_group_edition`: con la carga abierta tira
--   `POLLA_EDITION_LOAD_OPEN`. Generar la liquidación de pasadores ya lo
--   hacía (`polla_liquidate_edition_accounts`).
-- * `polla_set_edition_liquidated`: marcar la edición como liquidada con la
--   carga abierta tira `POLLA_EDITION_LOAD_OPEN`. Desmarcarla anda siempre.
--
-- Mismas definiciones que 20261115204744, 20261115210000, 20261114150000 y
-- 20261114141228.

CREATE OR REPLACE FUNCTION polla_edition_account_list(
  p_organization_id UUID,
  -- NULL: todas; FALSE: a liquidar; TRUE: liquidaciones realizadas.
  p_liquidated BOOLEAN DEFAULT NULL,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_with_counts BOOLEAN DEFAULT TRUE,
  p_limit INTEGER DEFAULT NULL,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH page AS (
    SELECT e.polla_edition_id, e.polla_organization_id, e.start_date, e.liquidated_at, e.liquidated_by,
           polla_now() < polla_edition_load_close(e) AS load_open,
           -- Total con los filtros, sin la página (la ventana se calcula antes del LIMIT).
           count(*) OVER () AS total_count
    FROM polla_editions e
    WHERE e.polla_organization_id = p_organization_id
      AND e.account_by_edition
      AND e.deleted_at IS NULL
      AND (polla_now() >= polla_edition_load_close(e) OR e.start_date <= polla_today())
      AND (p_liquidated IS NULL OR (e.liquidated_at IS NOT NULL) = p_liquidated)
      AND (p_from IS NULL OR e.start_date >= p_from)
      AND (p_to IS NULL OR e.start_date <= p_to)
    ORDER BY e.start_date DESC, e.polla_edition_id
    LIMIT p_limit
    OFFSET COALESCE(p_offset, 0)
  )
  SELECT jsonb_build_object(
    'polla_edition_id', p.polla_edition_id,
    'liquidated_at', p.liquidated_at,
    'liquidated_by_name', lb.name,
    'cashiers_count', CASE WHEN p_with_counts THEN t.cashiers_count END,
    'liquidated_count', CASE WHEN p_with_counts THEN t.liquidated_count END,
    'owed_by_cashiers', CASE WHEN p_with_counts THEN t.owed_by_cashiers END,
    'owed_to_cashiers', CASE WHEN p_with_counts THEN t.owed_to_cashiers END,
    'load_open', p.load_open,
    'total_count', p.total_count
  )
  FROM page p
  LEFT JOIN polla_users lb ON lb.polla_user_id = p.liquidated_by
  LEFT JOIN LATERAL (
    SELECT
      (count(*) FILTER (WHERE m.has_movement))::INTEGER AS cashiers_count,
      (count(*) FILTER (WHERE m.has_movement AND b.liquidation_id IS NOT NULL))::INTEGER AS liquidated_count,
      COALESCE(SUM(b.total) FILTER (WHERE b.total > 0), 0)::NUMERIC(12,2) AS owed_by_cashiers,
      COALESCE(-SUM(b.total) FILTER (WHERE b.total < 0), 0)::NUMERIC(12,2) AS owed_to_cashiers
    FROM polla_edition_account_base(p.polla_organization_id, p.polla_edition_id) b
    CROSS JOIN LATERAL (
      SELECT b.bets_pass <> 0 OR b.deleted_pass <> 0 OR b.claims <> 0
             OR b.collections <> 0 OR b.paid <> 0 AS has_movement
    ) m
    -- Sin contadores no se calcula la cuenta.
    WHERE p_with_counts
  ) t ON TRUE
  ORDER BY p.start_date DESC, p.polla_edition_id;
$$;

REVOKE ALL ON FUNCTION polla_edition_account_list(UUID, BOOLEAN, DATE, DATE, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_account_list(UUID, BOOLEAN, DATE, DATE, BOOLEAN, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION polla_validate_edition_account_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
BEGIN
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = NEW.polla_edition_id
    AND polla_organization_id = NEW.polla_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF NOT v_edition.account_by_edition THEN
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

CREATE OR REPLACE FUNCTION polla_liquidate_group_edition(
  p_organization_id UUID,
  p_group_id UUID,
  p_edition_id UUID,
  p_percentage NUMERIC,
  p_adjustments NUMERIC,
  p_paid NUMERIC,
  p_actor_id UUID
)
RETURNS polla_group_edition_accounts
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_preview JSONB;
  v_base NUMERIC(12,2);
  v_percentage NUMERIC(5,2);
  v_commission NUMERIC(12,2);
  v_row polla_group_edition_accounts;
  v_edition polla_editions;
BEGIN
  IF p_percentage IS NULL OR p_percentage < 0 OR p_percentage > 100 THEN
    RAISE EXCEPTION 'POLLA_GROUP_PERCENTAGE_INVALID';
  END IF;

  -- El % se guarda con 2 decimales: la comisión se calcula con ese mismo valor.
  v_percentage := ROUND(p_percentage, 2);

  -- Con la carga abierta todavía se mueve la cuenta de los pasadores.
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND polla_organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF polla_now() < polla_edition_load_close(v_edition) THEN
    RAISE EXCEPTION 'POLLA_EDITION_LOAD_OPEN';
  END IF;

  -- Una liquidación de grupo por edición a la vez.
  PERFORM pg_advisory_xact_lock(hashtext('polla-group-edition-liq:' || p_group_id || ':' || p_edition_id));

  -- Se calcula una sola vez, ya con el candado tomado.
  v_preview := polla_group_edition_account_preview(p_organization_id, p_group_id, p_edition_id);

  IF jsonb_array_length(v_preview->'pending_cashiers') > 0 THEN
    RAISE EXCEPTION 'POLLA_GROUP_CASHIERS_PENDING';
  END IF;

  v_base := (v_preview->>'base')::NUMERIC;
  v_commission := ROUND(GREATEST(v_base, 0) * v_percentage / 100, 2);

  INSERT INTO polla_group_edition_accounts (
    polla_organization_id, polla_group_id, polla_edition_id, group_name,
    cashiers_subtotal, expenses, base,
    admin_percentage, admin_commission, adjustments, paid, total,
    created_by
  ) VALUES (
    p_organization_id, p_group_id, p_edition_id, v_preview->>'group_name',
    (v_preview->>'cashiers_subtotal')::NUMERIC,
    (v_preview->>'expenses')::NUMERIC,
    v_base,
    v_percentage, v_commission,
    COALESCE(p_adjustments, 0), COALESCE(p_paid, 0),
    v_commission + COALESCE(p_adjustments, 0) - COALESCE(p_paid, 0),
    p_actor_id
  )
  ON CONFLICT (polla_group_id, polla_edition_id) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    cashiers_subtotal = EXCLUDED.cashiers_subtotal,
    expenses = EXCLUDED.expenses,
    base = EXCLUDED.base,
    admin_percentage = EXCLUDED.admin_percentage,
    admin_commission = EXCLUDED.admin_commission,
    adjustments = EXCLUDED.adjustments,
    paid = EXCLUDED.paid,
    total = EXCLUDED.total,
    created_by = EXCLUDED.created_by,
    edited_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION polla_liquidate_group_edition(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_liquidate_group_edition(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, UUID) TO service_role;

CREATE OR REPLACE FUNCTION polla_set_edition_liquidated(
  p_organization_id UUID,
  p_edition_id UUID,
  p_actor_id UUID,
  p_liquidated BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
BEGIN
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND polla_organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF NOT v_edition.account_by_edition THEN
    RAISE EXCEPTION 'POLLA_EDITION_ACCOUNT_DISABLED';
  END IF;

  -- Con la carga abierta todavía se mueve la cuenta: no se marca (desmarcar sí).
  IF p_liquidated AND polla_now() < polla_edition_load_close(v_edition) THEN
    RAISE EXCEPTION 'POLLA_EDITION_LOAD_OPEN';
  END IF;

  UPDATE polla_editions
  SET liquidated_at = CASE WHEN p_liquidated THEN NOW() END,
      liquidated_by = CASE WHEN p_liquidated THEN p_actor_id END
  WHERE polla_edition_id = p_edition_id
  RETURNING * INTO v_edition;

  RETURN jsonb_build_object(
    'polla_edition_id', v_edition.polla_edition_id,
    'liquidated_at', v_edition.liquidated_at,
    'liquidated_by', v_edition.liquidated_by
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_set_edition_liquidated(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_set_edition_liquidated(UUID, UUID, UUID, BOOLEAN) TO service_role;

-- ROLLBACK:
-- Volver a crear, con sus definiciones anteriores:
-- * `polla_edition_account_list`: 20261115204744_polla_edition_account_list_paged.sql
--   (con su REVOKE y GRANT).
-- * `polla_validate_edition_account_movement`: 20261115210000_polla_movements_after_load_close.sql
-- * `polla_liquidate_group_edition`: 20261114150000_polla_group_edition_accounts.sql
--   (con su REVOKE y GRANT).
-- * `polla_set_edition_liquidated`: 20261114141228_polla_edition_account_functions.sql
--   (con su REVOKE y GRANT).
