-- % de ganancia del admin de grupo y liquidar varios grupos juntos (17/11/2026).
--
-- * `polla_users.admin_percentage`: el % que cobra el admin sobre lo que deja
--   su grupo en cada edición. Solo lo tiene un ADMIN; NULL = se carga a mano
--   al liquidar (los admins de antes quedan así).
-- * `polla_create_group_with_admin`: lee `admin_percentage` del admin.
--   Misma definición que 20261021233442.
-- * `polla_liquidate_group_edition`: si el admin del grupo tiene %, se usa ese
--   e ignora el que manda el cliente; si no, exige uno válido. Misma
--   definición que 20261116074720.
-- * `polla_liquidate_group_editions` (nueva): varios grupos en una
--   transacción, por número de grupo. Si uno falla no se liquida ninguno y el
--   error dice qué grupo: `POLLA_GROUP_BATCH[Grupo N - Nombre] <error>`.

-- ============================================================
-- 1. % del admin
-- ============================================================

ALTER TABLE polla_users ADD COLUMN IF NOT EXISTS admin_percentage NUMERIC(5,2);

COMMENT ON COLUMN polla_users.admin_percentage IS
  '% de ganancia del admin de grupo en la liquidación del grupo. NULL: se carga a mano al liquidar.';

ALTER TABLE polla_users DROP CONSTRAINT IF EXISTS polla_users_admin_percentage_check;
ALTER TABLE polla_users
  ADD CONSTRAINT polla_users_admin_percentage_check CHECK (
    admin_percentage IS NULL
    OR (user_type = 'ADMIN' AND admin_percentage BETWEEN 0 AND 100)
  );

-- ============================================================
-- 2. Alta de un grupo con su admin
-- ============================================================

CREATE OR REPLACE FUNCTION polla_create_group_with_admin(
  p_organization_id UUID,
  p_name TEXT,
  p_admin JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_group polla_groups;
  v_admin_id UUID;
BEGIN
  INSERT INTO polla_groups (polla_organization_id, name)
  VALUES (p_organization_id, p_name)
  RETURNING * INTO v_group;

  INSERT INTO polla_users (
    user_type,
    name,
    last_name,
    username,
    email,
    phone,
    password_hash,
    password_changed_at,
    polla_organization_id,
    polla_group_id,
    admin_percentage
  ) VALUES (
    'ADMIN',
    p_admin->>'name',
    NULLIF(p_admin->>'last_name', ''),
    p_admin->>'username',
    NULLIF(p_admin->>'email', ''),
    (p_admin->>'phone')::BIGINT,
    p_admin->>'password_hash',
    NOW(),
    p_organization_id,
    v_group.polla_group_id,
    (NULLIF(p_admin->>'admin_percentage', ''))::NUMERIC
  )
  RETURNING polla_user_id INTO v_admin_id;

  RETURN jsonb_build_object(
    'group', to_jsonb(v_group),
    'admin_polla_user_id', v_admin_id
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_create_group_with_admin(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_create_group_with_admin(UUID, TEXT, JSONB) TO service_role;

-- ============================================================
-- 3. Liquidar un grupo: el % del admin manda
-- ============================================================

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
  v_admin_percentage NUMERIC(5,2);
  -- Sin precisión: un valor fuera de rango tiene que llegar al control, no desbordar.
  v_percentage NUMERIC;
  v_commission NUMERIC(12,2);
  v_row polla_group_edition_accounts;
  v_edition polla_editions;
BEGIN
  -- El % configurado en el admin del grupo gana sobre el que manda el cliente.
  SELECT admin_percentage INTO v_admin_percentage
  FROM polla_users
  WHERE polla_group_id = p_group_id
    AND polla_organization_id = p_organization_id
    AND user_type = 'ADMIN'
    AND deleted_at IS NULL;

  v_percentage := COALESCE(v_admin_percentage, p_percentage);

  IF v_percentage IS NULL OR v_percentage < 0 OR v_percentage > 100 THEN
    RAISE EXCEPTION 'POLLA_GROUP_PERCENTAGE_INVALID';
  END IF;

  -- El % se guarda con 2 decimales: la comisión se calcula con ese mismo valor.
  v_percentage := ROUND(v_percentage, 2);

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

-- ============================================================
-- 4. Liquidar varios grupos juntos
-- ============================================================

DROP FUNCTION IF EXISTS polla_liquidate_group_editions(UUID, UUID, JSONB, UUID);

CREATE FUNCTION polla_liquidate_group_editions(
  p_organization_id UUID,
  p_edition_id UUID,
  -- [{ "polla_group_id": uuid, "admin_percentage": number | null }]
  p_entries JSONB,
  p_actor_id UUID
)
RETURNS SETOF polla_group_edition_accounts
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_row polla_group_edition_accounts;
BEGIN
  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'POLLA_GROUP_BATCH_EMPTY';
  END IF;

  IF (
    SELECT count(DISTINCT e.polla_group_id) <> count(*)
    FROM jsonb_to_recordset(p_entries) AS e(polla_group_id UUID)
  ) THEN
    RAISE EXCEPTION 'POLLA_GROUP_BATCH_DUPLICATED';
  END IF;

  FOR v_entry IN
    SELECT e.polla_group_id, e.admin_percentage, g.number, g.name
    FROM jsonb_to_recordset(p_entries) AS e(polla_group_id UUID, admin_percentage NUMERIC)
    LEFT JOIN polla_groups g
      ON g.polla_group_id = e.polla_group_id
     AND g.polla_organization_id = p_organization_id
     AND g.deleted_at IS NULL
    ORDER BY g.number NULLS FIRST
  LOOP
    IF v_entry.number IS NULL THEN
      RAISE EXCEPTION 'POLLA_GROUP_NOT_FOUND';
    END IF;

    BEGIN
      v_row := polla_liquidate_group_edition(
        p_organization_id, v_entry.polla_group_id, p_edition_id,
        v_entry.admin_percentage, 0, 0, p_actor_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Se vuelve a lanzar con el grupo: la transacción entera se deshace.
      RAISE EXCEPTION 'POLLA_GROUP_BATCH[Grupo % - %] %', v_entry.number, v_entry.name, SQLERRM;
    END;

    RETURN NEXT v_row;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION polla_liquidate_group_editions(UUID, UUID, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_liquidate_group_editions(UUID, UUID, JSONB, UUID) TO service_role;
