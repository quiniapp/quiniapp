-- Cuenta del grupo por edición: vista previa y liquidación.
--
-- * `polla_group_edition_account_preview`: lo que dejaron los pasadores del
--   grupo (según su liquidación vigente, con el grupo que tenían al
--   liquidar), los gastos del grupo en la edición, la base, los pasadores
--   pendientes y la cuenta guardada.
-- * `polla_liquidate_group_edition`: guarda la cuenta del grupo (una fila por
--   grupo y edición, se rehace al liquidar de nuevo). Sin arrastre ni saldo
--   anterior.
--
--   admin_commission = ROUND(GREATEST(base, 0) * ROUND(porcentaje, 2) / 100, 2)
--   total = admin_commission + ajustes - pagado

-- ============================================================
-- 1. Vista previa
-- ============================================================

CREATE FUNCTION polla_group_edition_account_preview(
  p_organization_id UUID,
  p_group_id UUID,
  p_edition_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_group polla_groups;
  v_edition polla_editions;
  v_subtotal NUMERIC(12,2);
  v_expenses NUMERIC(12,2);
  v_pending JSONB;
  v_account polla_group_edition_accounts;
BEGIN
  SELECT * INTO v_group
  FROM polla_groups
  WHERE polla_group_id = p_group_id
    AND polla_organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_GROUP_NOT_FOUND';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND polla_organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF NOT v_edition.account_by_edition THEN
    RAISE EXCEPTION 'POLLA_EDITION_ACCOUNT_DISABLED';
  END IF;

  -- Liquidación vigente de cada pasador (la más nueva); cuenta en el grupo que
  -- quedó guardado en ella, aunque el pasador haya cambiado de grupo después.
  SELECT COALESCE(SUM(v.subtotal), 0) INTO v_subtotal
  FROM (
    SELECT DISTINCT ON (l.polla_user_id) l.polla_group_id, l.subtotal
    FROM polla_edition_liquidations l
    WHERE l.polla_edition_id = p_edition_id
      AND l.polla_organization_id = p_organization_id
    ORDER BY l.polla_user_id, l.created_at DESC, l.polla_edition_liquidation_id DESC
  ) v
  WHERE v.polla_group_id = p_group_id;

  SELECT COALESCE(SUM(x.amount), 0) INTO v_expenses
  FROM polla_org_expenses x
  WHERE x.polla_organization_id = p_organization_id
    AND x.polla_group_id = p_group_id
    AND x.polla_edition_id = p_edition_id;

  -- Pasadores que hoy están en el grupo, con movimiento y sin liquidación vigente.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'polla_user_id', b.polla_user_id,
    'name', b.user_name,
    'number', b.user_number
  ) ORDER BY b.user_number NULLS LAST, b.user_name), '[]'::JSONB) INTO v_pending
  FROM polla_edition_account_base(p_organization_id, p_edition_id) b
  WHERE b.liquidation_id IS NULL
    AND b.live_group_id = p_group_id
    AND (b.bets_pass <> 0 OR b.deleted_pass <> 0 OR b.claims <> 0
         OR b.collections <> 0 OR b.paid <> 0);

  SELECT * INTO v_account
  FROM polla_group_edition_accounts
  WHERE polla_group_id = p_group_id
    AND polla_edition_id = p_edition_id;

  RETURN jsonb_build_object(
    'polla_group_id', p_group_id,
    'group_name', v_group.name,
    'polla_edition_id', p_edition_id,
    'cashiers_subtotal', v_subtotal,
    'expenses', v_expenses,
    'base', v_subtotal - v_expenses,
    'pending_cashiers', v_pending,
    'account', CASE WHEN v_account.polla_group_edition_account_id IS NULL THEN NULL ELSE to_jsonb(v_account) END
  );
END;
$$;

-- ============================================================
-- 2. Liquidar el grupo
-- ============================================================

CREATE FUNCTION polla_liquidate_group_edition(
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
BEGIN
  IF p_percentage IS NULL OR p_percentage < 0 OR p_percentage > 100 THEN
    RAISE EXCEPTION 'POLLA_GROUP_PERCENTAGE_INVALID';
  END IF;

  -- El % se guarda con 2 decimales: la comisión se calcula con ese mismo valor.
  v_percentage := ROUND(p_percentage, 2);

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

-- ============================================================
-- 3. Borrar un grupo: chequeo por edición
-- ============================================================

-- Se puede borrar sin jugadas en ediciones en juego y, en cada edición por
-- edición donde el grupo tiene algo: sus pasadores con movimiento liquidados y
-- la cuenta del grupo liquidada y al día (si hay algo para liquidar). La cuenta
-- por días es historia congelada y no cuenta. El resto (baja de usuarios,
-- sesiones y grupo) es el de la función original.
CREATE OR REPLACE FUNCTION polla_delete_group(
  p_group_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_group polla_groups;
  v_edition_id UUID;
  v_preview JSONB;
  v_account JSONB;
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

  -- Pasadores sin liquidar, en cualquier edición por edición donde el grupo
  -- pueda tener algo (tickets o movimientos de sus pasadores de hoy, sus
  -- liquidaciones, su cuenta o sus gastos).
  FOR v_edition_id IN
    SELECT e.polla_edition_id
    FROM polla_editions e
    WHERE e.polla_organization_id = v_group.polla_organization_id
      AND e.deleted_at IS NULL
      AND e.account_by_edition
      AND (
        EXISTS (
          SELECT 1 FROM polla_bets b
          JOIN polla_users u ON u.polla_user_id = b.cashier_polla_user_id
          WHERE b.polla_edition_id = e.polla_edition_id
            AND u.polla_group_id = p_group_id AND u.user_type = 'CASHIER'
        )
        OR EXISTS (
          SELECT 1 FROM polla_edition_account_movements m
          JOIN polla_users u ON u.polla_user_id = m.polla_user_id
          WHERE m.polla_edition_id = e.polla_edition_id
            AND u.polla_group_id = p_group_id AND u.user_type = 'CASHIER'
        )
        OR EXISTS (
          SELECT 1 FROM polla_edition_liquidations l
          LEFT JOIN polla_users u ON u.polla_user_id = l.polla_user_id
          WHERE l.polla_edition_id = e.polla_edition_id
            AND (l.polla_group_id = p_group_id OR u.polla_group_id = p_group_id)
        )
        OR EXISTS (
          SELECT 1 FROM polla_group_edition_accounts a
          WHERE a.polla_edition_id = e.polla_edition_id AND a.polla_group_id = p_group_id
        )
        OR EXISTS (
          SELECT 1 FROM polla_org_expenses x
          WHERE x.polla_edition_id = e.polla_edition_id AND x.polla_group_id = p_group_id
        )
      )
  LOOP
    v_preview := polla_group_edition_account_preview(v_group.polla_organization_id, p_group_id, v_edition_id);
    IF jsonb_array_length(v_preview->'pending_cashiers') > 0 THEN
      RAISE EXCEPTION 'POLLA_GROUP_CASHIERS_PENDING';
    END IF;
  END LOOP;

  -- Cuenta del grupo: si hay algo para liquidar, tiene que estar liquidada y
  -- con los mismos valores de hoy (igual que "desactualizada" en la web).
  FOR v_edition_id IN
    SELECT e.polla_edition_id
    FROM polla_editions e
    WHERE e.polla_organization_id = v_group.polla_organization_id
      AND e.deleted_at IS NULL
      AND e.account_by_edition
      AND (
        EXISTS (
          SELECT 1 FROM polla_edition_liquidations l
          WHERE l.polla_edition_id = e.polla_edition_id AND l.polla_group_id = p_group_id
        )
        OR EXISTS (
          SELECT 1 FROM polla_group_edition_accounts a
          WHERE a.polla_edition_id = e.polla_edition_id AND a.polla_group_id = p_group_id
        )
        OR EXISTS (
          SELECT 1 FROM polla_org_expenses x
          WHERE x.polla_edition_id = e.polla_edition_id AND x.polla_group_id = p_group_id
        )
      )
  LOOP
    v_preview := polla_group_edition_account_preview(v_group.polla_organization_id, p_group_id, v_edition_id);
    IF (v_preview->>'cashiers_subtotal')::NUMERIC <> 0 OR (v_preview->>'expenses')::NUMERIC <> 0 THEN
      v_account := v_preview->'account';
      IF v_account IS NULL OR jsonb_typeof(v_account) = 'null'
         OR (v_account->>'cashiers_subtotal')::NUMERIC <> (v_preview->>'cashiers_subtotal')::NUMERIC
         OR (v_account->>'expenses')::NUMERIC <> (v_preview->>'expenses')::NUMERIC THEN
        RAISE EXCEPTION 'POLLA_GROUP_ACCOUNT_OPEN';
      END IF;
    END IF;
  END LOOP;

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

-- ============================================================
-- 4. Permisos
-- ============================================================

REVOKE ALL ON FUNCTION polla_group_edition_account_preview(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_group_edition_account_preview(UUID, UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_liquidate_group_edition(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_liquidate_group_edition(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, UUID) TO service_role;

REVOKE ALL ON FUNCTION polla_delete_group(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_delete_group(UUID, UUID) TO service_role;

-- ROLLBACK:
-- -- Restaurar `polla_delete_group` (con el chequeo por días) desde la sección 5
-- -- de 20261021233443_polla_group_accounts.sql (DROP + CREATE + REVOKE/GRANT).
-- DROP FUNCTION polla_liquidate_group_edition(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, UUID);
-- DROP FUNCTION polla_group_edition_account_preview(UUID, UUID, UUID);
