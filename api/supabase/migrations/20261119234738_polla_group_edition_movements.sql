-- Cobros y pagos de grupo (19/11/2026).
--
-- * `polla_group_edition_movements` (nueva): cada cobro o pago que se carga al
--   liquidar un grupo en una edición. Solo COLLECTION y PAYMENT, siempre > 0.
-- * `polla_group_edition_accounts.collections` / `payments`: suma de los
--   movimientos vigentes; los mantiene un trigger y NO toca `edited_at`
--   (editar o borrar un movimiento no cambia la fecha de liquidación).
-- * `polla_liquidate_group_edition`: recibe `p_collection` y `p_payment`
--   (NULL = 0; < 0 lanza POLLA_GROUP_MOVEMENT_INVALID) y, por cada monto > 0,
--   inserta un movimiento después del upsert. Devuelve la fila releída. El
--   resto es igual a 20261117233719. La firma cambia: DROP de la vieja.
-- * `polla_liquidate_group_editions`: cada entrada acepta además `collection` y
--   `payment` y los pasa al RPC de a un grupo (todo o nada, como antes).

-- ============================================================
-- 1. Movimientos
-- ============================================================

CREATE TABLE polla_group_edition_movements (
  polla_group_edition_movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  polla_group_id UUID NOT NULL REFERENCES polla_groups(polla_group_id),
  polla_edition_id UUID NOT NULL REFERENCES polla_editions(polla_edition_id),
  type polla_account_movement_type_enum NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT polla_today(),
  created_by UUID REFERENCES polla_users(polla_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_by UUID REFERENCES polla_users(polla_user_id),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES polla_users(polla_user_id),
  CONSTRAINT polla_group_edition_movements_type_check CHECK (type IN ('COLLECTION', 'PAYMENT')),
  CONSTRAINT polla_group_edition_movements_amount_check CHECK (amount > 0)
);

CREATE INDEX idx_polla_group_edition_movements_group_edition
  ON polla_group_edition_movements (polla_group_id, polla_edition_id)
  WHERE deleted_at IS NULL;

ALTER TABLE polla_group_edition_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE polla_group_edition_movements FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE polla_group_edition_movements TO service_role;

-- ============================================================
-- 2. Sumas en la cuenta del grupo
-- ============================================================

ALTER TABLE polla_group_edition_accounts
  ADD COLUMN IF NOT EXISTS collections NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payments NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN polla_group_edition_accounts.collections IS
  'Suma de los cobros vigentes del grupo en la edición (polla_group_edition_movements).';
COMMENT ON COLUMN polla_group_edition_accounts.payments IS
  'Suma de los pagos vigentes del grupo en la edición (polla_group_edition_movements).';

-- Recalcula las dos sumas del grupo y la edición del movimiento. No toca edited_at.
CREATE OR REPLACE FUNCTION polla_group_edition_movement_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Mismo candado que la liquidación del grupo: los SUM de abajo toman su snapshot
  -- después de que termine una liquidación o una edición concurrente.
  PERFORM pg_advisory_xact_lock(hashtext('polla-group-edition-liq:' || NEW.polla_group_id || ':' || NEW.polla_edition_id));

  UPDATE polla_group_edition_accounts a
  SET collections = COALESCE((
        SELECT SUM(m.amount) FROM polla_group_edition_movements m
        WHERE m.polla_group_id = NEW.polla_group_id
          AND m.polla_edition_id = NEW.polla_edition_id
          AND m.deleted_at IS NULL AND m.type = 'COLLECTION'), 0),
      payments = COALESCE((
        SELECT SUM(m.amount) FROM polla_group_edition_movements m
        WHERE m.polla_group_id = NEW.polla_group_id
          AND m.polla_edition_id = NEW.polla_edition_id
          AND m.deleted_at IS NULL AND m.type = 'PAYMENT'), 0)
  WHERE a.polla_group_id = NEW.polla_group_id
    AND a.polla_edition_id = NEW.polla_edition_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_polla_group_edition_movement_sync ON polla_group_edition_movements;
CREATE TRIGGER trg_polla_group_edition_movement_sync
  AFTER INSERT OR UPDATE ON polla_group_edition_movements
  FOR EACH ROW EXECUTE FUNCTION polla_group_edition_movement_sync();

-- ============================================================
-- 3. Liquidar un grupo, con cobro y pago
-- ============================================================

DROP FUNCTION IF EXISTS polla_liquidate_group_edition(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, UUID);

CREATE FUNCTION polla_liquidate_group_edition(
  p_organization_id UUID,
  p_group_id UUID,
  p_edition_id UUID,
  p_percentage NUMERIC,
  p_adjustments NUMERIC,
  p_paid NUMERIC,
  p_collection NUMERIC,
  p_payment NUMERIC,
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
  v_collection NUMERIC := ROUND(COALESCE(p_collection, 0), 2);
  v_payment NUMERIC := ROUND(COALESCE(p_payment, 0), 2);
  v_row polla_group_edition_accounts;
  v_edition polla_editions;
BEGIN
  IF v_collection < 0 OR v_payment < 0 THEN
    RAISE EXCEPTION 'POLLA_GROUP_MOVEMENT_INVALID';
  END IF;

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
    edited_at = NOW();

  -- Los movimientos van después del upsert: el trigger suma sobre la fila ya creada.
  IF v_collection > 0 THEN
    INSERT INTO polla_group_edition_movements (
      polla_organization_id, polla_group_id, polla_edition_id, type, amount, created_by
    ) VALUES (p_organization_id, p_group_id, p_edition_id, 'COLLECTION', v_collection, p_actor_id);
  END IF;

  IF v_payment > 0 THEN
    INSERT INTO polla_group_edition_movements (
      polla_organization_id, polla_group_id, polla_edition_id, type, amount, created_by
    ) VALUES (p_organization_id, p_group_id, p_edition_id, 'PAYMENT', v_payment, p_actor_id);
  END IF;

  -- Se relee: el trigger cambió collections / payments después del upsert.
  SELECT * INTO v_row
  FROM polla_group_edition_accounts
  WHERE polla_group_id = p_group_id AND polla_edition_id = p_edition_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION polla_liquidate_group_edition(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_liquidate_group_edition(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID) TO service_role;

-- ============================================================
-- 4. Liquidar varios grupos juntos
-- ============================================================

DROP FUNCTION IF EXISTS polla_liquidate_group_editions(UUID, UUID, JSONB, UUID);

CREATE FUNCTION polla_liquidate_group_editions(
  p_organization_id UUID,
  p_edition_id UUID,
  -- [{ "polla_group_id": uuid, "admin_percentage": number | null, "collection": number | null, "payment": number | null }]
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
    SELECT e.polla_group_id, e.admin_percentage, e.collection, e.payment, g.number, g.name
    FROM jsonb_to_recordset(p_entries)
      AS e(polla_group_id UUID, admin_percentage NUMERIC, collection NUMERIC, payment NUMERIC)
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
        v_entry.admin_percentage, 0, 0, v_entry.collection, v_entry.payment, p_actor_id
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

-- ROLLBACK:
-- DROP FUNCTION polla_liquidate_group_editions(UUID, UUID, JSONB, UUID);
-- DROP FUNCTION polla_liquidate_group_edition(UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, UUID);
-- (recrear ambas con el cuerpo de 20261117233719_polla_admin_percentage.sql, secciones 3 y 4)
-- DROP TRIGGER trg_polla_group_edition_movement_sync ON polla_group_edition_movements;
-- DROP FUNCTION polla_group_edition_movement_sync();
-- ALTER TABLE polla_group_edition_accounts DROP COLUMN collections, DROP COLUMN payments;
-- DROP TABLE polla_group_edition_movements;
