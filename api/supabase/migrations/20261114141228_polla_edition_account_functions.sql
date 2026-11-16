-- Cuenta corriente por edición: funciones.
--
-- * `polla_edition_account_base`: cálculo interno, una fila por pasador, con
--   los valores de la liquidación vigente y los del cálculo en vivo.
-- * `polla_edition_account_rows`: la cuenta de cada pasador en una edición
--   (JSONB), con la liquidación vigente si la hay.
-- * `polla_liquidate_edition_accounts`: guarda una foto por pasador; avisa las
--   diferencias contra la liquidación vigente antes de escribir.
-- * `polla_set_edition_liquidated`: marca o desmarca la edición como liquidada.
-- * `polla_edition_account_list`: ediciones con la carga cortada y su estado.
-- * `polla_edition_account_totals`: totales por edición (con filtro de grupo).
-- * `polla_user_edition_accounts`: las ediciones donde el pasador tiene
--   liquidación y su cuenta en cada una.
--
-- Fórmulas (sin premios, deje, bills ni saldo anterior):
--   pass = bets_pass - deleted_pass + reclamos positivos
--   cashier_commission = ROUND(pass * fee / 100, 2)
--   subtotal = pass - cashier_commission + reclamos negativos
--   total = subtotal - collections + paid

-- ============================================================
-- 1. Cálculo interno
-- ============================================================

-- Con liquidación vigente, `bets_pass`, `deleted_pass`, `fee` y el grupo salen
-- de ella; los movimientos son siempre en vivo. Los valores `live_*` son el
-- cálculo con los tickets de hoy.
CREATE FUNCTION polla_edition_account_base(
  p_organization_id UUID,
  p_edition_id UUID,
  p_group_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  polla_user_id UUID,
  user_name TEXT,
  user_number INTEGER,
  polla_group_id UUID,
  fee NUMERIC,
  bets_pass NUMERIC,
  deleted_pass NUMERIC,
  claims NUMERIC,
  pass NUMERIC,
  cashier_commission NUMERIC,
  subtotal NUMERIC,
  collections NUMERIC,
  paid NUMERIC,
  total NUMERIC,
  live_group_id UUID,
  live_fee NUMERIC,
  live_bets_pass NUMERIC,
  live_deleted_pass NUMERIC,
  live_pass NUMERIC,
  live_cashier_commission NUMERIC,
  live_subtotal NUMERIC,
  live_total NUMERIC,
  differs BOOLEAN,
  liquidation_id UUID,
  liquidation_created_at TIMESTAMPTZ,
  liquidation_created_by_name TEXT,
  liquidation_total NUMERIC,
  liquidation_kept_previous_tickets BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH cashiers AS (
    SELECT u.polla_user_id AS uid, u.name AS uname, u.number AS unumber,
           u.polla_group_id AS ugroup, u.fee AS ufee
    FROM polla_users u
    WHERE u.polla_organization_id = p_organization_id
      AND u.user_type = 'CASHIER'
      AND (p_user_id IS NULL OR u.polla_user_id = p_user_id)
      AND (
        u.deleted_at IS NULL
        OR EXISTS (
          SELECT 1 FROM polla_bets b
          WHERE b.polla_edition_id = p_edition_id
            AND b.cashier_polla_user_id = u.polla_user_id
            AND (b.deleted_at IS NULL OR b.deducted_on IS NOT NULL)
        )
        OR EXISTS (
          SELECT 1 FROM polla_edition_account_movements m
          WHERE m.polla_edition_id = p_edition_id
            AND m.polla_user_id = u.polla_user_id
            AND m.deleted_at IS NULL
        )
      )
  ),
  tickets AS (
    SELECT b.cashier_polla_user_id AS uid,
           SUM(b.amount) AS bets,
           COALESCE(SUM(b.amount) FILTER (WHERE b.deducted_on IS NOT NULL), 0) AS deleted
    FROM polla_bets b
    WHERE b.polla_edition_id = p_edition_id
      AND b.polla_organization_id = p_organization_id
      AND (b.deleted_at IS NULL OR b.deducted_on IS NOT NULL)
    GROUP BY b.cashier_polla_user_id
  ),
  movs AS (
    SELECT m.polla_user_id AS uid,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'CLAIM'), 0) AS claims_all,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'CLAIM' AND m.amount > 0), 0) AS claims_pos,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'CLAIM' AND m.amount < 0), 0) AS claims_neg,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'COLLECTION'), 0) AS cols,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'PAYMENT'), 0) AS pays
    FROM polla_edition_account_movements m
    WHERE m.polla_edition_id = p_edition_id
      AND m.polla_organization_id = p_organization_id
      AND m.deleted_at IS NULL
    GROUP BY m.polla_user_id
  ),
  liqs AS (
    SELECT DISTINCT ON (l.polla_user_id)
           l.polla_user_id AS uid, l.polla_edition_liquidation_id AS lid, l.created_at AS lcreated,
           cb.name AS lby, l.total AS ltotal, l.kept_previous_tickets AS lkept,
           l.bets_pass AS lbets, l.deleted_pass AS ldeleted, l.fee AS lfee
    FROM polla_edition_liquidations l
    LEFT JOIN polla_users cb ON cb.polla_user_id = l.created_by
    WHERE l.polla_edition_id = p_edition_id
      AND l.polla_organization_id = p_organization_id
    ORDER BY l.polla_user_id, l.created_at DESC, l.polla_edition_liquidation_id DESC
  ),
  raw AS (
    SELECT c.uid, c.uname, c.unumber, c.ugroup, c.ufee,
           COALESCE(t.bets, 0) AS live_bets, COALESCE(t.deleted, 0) AS live_deleted,
           COALESCE(m.claims_all, 0) AS claims_all, COALESCE(m.claims_pos, 0) AS claims_pos,
           COALESCE(m.claims_neg, 0) AS claims_neg, COALESCE(m.cols, 0) AS cols, COALESCE(m.pays, 0) AS pays,
           q.lid, q.lcreated, q.lby, q.ltotal, q.lkept,
           CASE WHEN q.lid IS NULL THEN COALESCE(t.bets, 0) ELSE q.lbets END AS e_bets,
           CASE WHEN q.lid IS NULL THEN COALESCE(t.deleted, 0) ELSE q.ldeleted END AS e_deleted,
           CASE WHEN q.lid IS NULL THEN c.ufee ELSE q.lfee END AS e_fee
    FROM cashiers c
    LEFT JOIN tickets t ON t.uid = c.uid
    LEFT JOIN movs m ON m.uid = c.uid
    LEFT JOIN liqs q ON q.uid = c.uid
  ),
  calc AS (
    SELECT r.*,
           r.e_bets - r.e_deleted + r.claims_pos AS e_pass,
           ROUND((r.e_bets - r.e_deleted + r.claims_pos) * COALESCE(r.e_fee, 0) / 100, 2) AS e_comm,
           r.live_bets - r.live_deleted + r.claims_pos AS l_pass,
           ROUND((r.live_bets - r.live_deleted + r.claims_pos) * COALESCE(r.ufee, 0) / 100, 2) AS l_comm
    FROM raw r
  ),
  fin AS (
    SELECT k.*,
           k.e_pass - k.e_comm + k.claims_neg AS e_sub,
           k.l_pass - k.l_comm + k.claims_neg AS l_sub
    FROM calc k
  )
  SELECT f.uid, f.uname, f.unumber,
         CASE WHEN f.lid IS NULL THEN f.ugroup ELSE (
           SELECT l.polla_group_id FROM polla_edition_liquidations l WHERE l.polla_edition_liquidation_id = f.lid
         ) END,
         f.e_fee,
         f.e_bets::NUMERIC(12,2), f.e_deleted::NUMERIC(12,2), f.claims_all::NUMERIC(12,2),
         f.e_pass::NUMERIC(12,2), f.e_comm::NUMERIC(12,2), f.e_sub::NUMERIC(12,2),
         f.cols::NUMERIC(12,2), f.pays::NUMERIC(12,2), (f.e_sub - f.cols + f.pays)::NUMERIC(12,2),
         f.ugroup, f.ufee,
         f.live_bets::NUMERIC(12,2), f.live_deleted::NUMERIC(12,2),
         f.l_pass::NUMERIC(12,2), f.l_comm::NUMERIC(12,2), f.l_sub::NUMERIC(12,2),
         (f.l_sub - f.cols + f.pays)::NUMERIC(12,2),
         f.lid IS NOT NULL AND (f.live_bets, f.live_deleted, f.ufee) IS DISTINCT FROM (f.e_bets, f.e_deleted, f.e_fee),
         f.lid, f.lcreated, f.lby, f.ltotal, f.lkept
  FROM fin f
  WHERE p_group_id IS NULL OR (
    CASE WHEN f.lid IS NULL THEN f.ugroup ELSE (
      SELECT l.polla_group_id FROM polla_edition_liquidations l WHERE l.polla_edition_liquidation_id = f.lid
    ) END
  ) = p_group_id
  ORDER BY 4 NULLS LAST, f.unumber;
END;
$$;

-- ============================================================
-- 2. La cuenta de cada pasador en una edición
-- ============================================================

CREATE FUNCTION polla_edition_account_rows(
  p_organization_id UUID,
  p_edition_id UUID,
  p_group_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'polla_user_id', b.polla_user_id,
    'user_name', b.user_name,
    'user_number', b.user_number,
    'polla_group_id', b.polla_group_id,
    'fee', b.fee,
    'bets_pass', b.bets_pass,
    'deleted_pass', b.deleted_pass,
    'claims', b.claims,
    'pass', b.pass,
    'cashier_commission', b.cashier_commission,
    'subtotal', b.subtotal,
    'revenue', b.subtotal,
    'collections', b.collections,
    'paid', b.paid,
    'total', b.total,
    'live_bets_pass', b.live_bets_pass,
    'live_deleted_pass', b.live_deleted_pass,
    'live_fee', b.live_fee,
    'differs', b.differs,
    'liquidation', CASE WHEN b.liquidation_id IS NULL THEN NULL ELSE jsonb_build_object(
      'polla_edition_liquidation_id', b.liquidation_id,
      'created_at', b.liquidation_created_at,
      'created_by_name', b.liquidation_created_by_name,
      'total', b.liquidation_total,
      'kept_previous_tickets', b.liquidation_kept_previous_tickets
    ) END
  )
  FROM polla_edition_account_base(p_organization_id, p_edition_id, p_group_id, p_user_id) b;
$$;

-- ============================================================
-- 3. Liquidar
-- ============================================================

CREATE FUNCTION polla_liquidate_edition_accounts(
  p_organization_id UUID,
  p_edition_id UUID,
  p_user_ids UUID[],
  p_actor_id UUID,
  p_ticket_source TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
  v_differences JSONB;
  v_liquidations JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('polla-edition-liq:' || p_edition_id));

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

  IF polla_now() < polla_load_cutoff(v_edition, 'OWNER') THEN
    RAISE EXCEPTION 'POLLA_EDITION_LOAD_OPEN';
  END IF;

  IF p_ticket_source IS NOT NULL AND p_ticket_source NOT IN ('NEW', 'OLD') THEN
    RAISE EXCEPTION 'POLLA_EDITION_LIQUIDATION_SOURCE_INVALID';
  END IF;

  IF COALESCE(cardinality(p_user_ids), 0) = 0 THEN
    RAISE EXCEPTION 'POLLA_EDITION_LIQUIDATION_EMPTY';
  END IF;

  -- La cuenta se calcula una sola vez y la usan el control de pasadores, el
  -- aviso de diferencias y la foto: un ticket que cambia entre una sentencia
  -- y otra no puede dejarlas en desacuerdo. La tabla vive hasta el fin de la
  -- transacción; si ya existe (otra liquidación en la misma), se rehace.
  IF to_regclass('pg_temp.polla_liquidation_base') IS NOT NULL THEN
    DROP TABLE pg_temp.polla_liquidation_base;
  END IF;
  CREATE TEMP TABLE polla_liquidation_base ON COMMIT DROP AS
  SELECT * FROM polla_edition_account_base(p_organization_id, p_edition_id);

  IF EXISTS (
    SELECT 1
    FROM unnest(p_user_ids) AS x(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM polla_liquidation_base b
      WHERE b.polla_user_id = x.id
    )
  ) THEN
    RAISE EXCEPTION 'POLLA_ACCOUNT_USER_NOT_CASHIER';
  END IF;

  -- Sin origen elegido, si hay diferencias contra la vigente no se escribe.
  IF p_ticket_source IS NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
      'polla_user_id', b.polla_user_id,
      'user_name', b.user_name,
      'user_number', b.user_number,
      'polla_group_id', b.polla_group_id,
      'old', jsonb_build_object(
        'bets_pass', b.bets_pass, 'deleted_pass', b.deleted_pass, 'fee', b.fee, 'total', b.total),
      'new', jsonb_build_object(
        'bets_pass', b.live_bets_pass, 'deleted_pass', b.live_deleted_pass, 'fee', b.live_fee,
        'total', b.live_total)
    ) ORDER BY b.user_number)
    INTO v_differences
    FROM polla_liquidation_base b
    WHERE b.polla_user_id = ANY (p_user_ids)
      AND b.differs;

    IF v_differences IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'DIFFERENCES', 'differences', v_differences);
    END IF;
  END IF;

  WITH inserted AS (
    INSERT INTO polla_edition_liquidations (
      polla_organization_id, polla_edition_id, polla_user_id, user_name, user_number, polla_group_id,
      fee, bets_pass, deleted_pass, claims, pass, cashier_commission, subtotal, collections, paid, total,
      kept_previous_tickets, created_by, created_at
    )
    SELECT
      p_organization_id, p_edition_id, b.polla_user_id, b.user_name, b.user_number, b.live_group_id,
      CASE WHEN keep.v THEN b.fee ELSE b.live_fee END,
      CASE WHEN keep.v THEN b.bets_pass ELSE b.live_bets_pass END,
      CASE WHEN keep.v THEN b.deleted_pass ELSE b.live_deleted_pass END,
      b.claims,
      CASE WHEN keep.v THEN b.pass ELSE b.live_pass END,
      CASE WHEN keep.v THEN b.cashier_commission ELSE b.live_cashier_commission END,
      CASE WHEN keep.v THEN b.subtotal ELSE b.live_subtotal END,
      b.collections, b.paid,
      CASE WHEN keep.v THEN b.total ELSE b.live_total END,
      keep.v, p_actor_id,
      -- Orden estable dentro de una misma transacción.
      clock_timestamp()
    FROM polla_liquidation_base b
    -- Sin origen elegido, `differs` es FALSE (si no, ya avisó las diferencias).
    CROSS JOIN LATERAL (SELECT p_ticket_source = 'OLD' AND b.differs AS v) keep
    WHERE b.polla_user_id = ANY (p_user_ids)
    RETURNING *
  )
  SELECT jsonb_agg(to_jsonb(i) ORDER BY i.user_number) INTO v_liquidations FROM inserted i;

  RETURN jsonb_build_object('status', 'LIQUIDATED', 'liquidations', COALESCE(v_liquidations, '[]'::JSONB));
END;
$$;

-- ============================================================
-- 4. Marca de edición liquidada
-- ============================================================

CREATE FUNCTION polla_set_edition_liquidated(
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

-- ============================================================
-- 5. Lista de ediciones (carga cortada)
-- ============================================================

CREATE FUNCTION polla_edition_account_list(p_organization_id UUID)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'polla_edition_id', e.polla_edition_id,
    'liquidated_at', e.liquidated_at,
    'liquidated_by_name', lb.name,
    'cashiers_count', t.cashiers_count,
    'liquidated_count', t.liquidated_count,
    'owed', t.owed
  )
  FROM polla_editions e
  LEFT JOIN polla_users lb ON lb.polla_user_id = e.liquidated_by
  CROSS JOIN LATERAL (
    SELECT
      (count(*) FILTER (WHERE b.bets_pass <> 0 OR b.deleted_pass <> 0 OR b.claims <> 0
                          OR b.collections <> 0 OR b.paid <> 0))::INTEGER AS cashiers_count,
      (count(*) FILTER (WHERE b.liquidation_id IS NOT NULL))::INTEGER AS liquidated_count,
      COALESCE(SUM(b.total), 0)::NUMERIC(12,2) AS owed
    FROM polla_edition_account_base(e.polla_organization_id, e.polla_edition_id) b
  ) t
  WHERE e.polla_organization_id = p_organization_id
    AND e.account_by_edition
    AND e.deleted_at IS NULL
    AND polla_now() >= polla_load_cutoff(e, 'OWNER')
  ORDER BY e.start_date DESC;
$$;

-- ============================================================
-- 6. Totales por edición
-- ============================================================

CREATE FUNCTION polla_edition_account_totals(
  p_organization_id UUID,
  p_edition_ids UUID[],
  p_group_id UUID DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'polla_edition_id', e.polla_edition_id,
    'date', e.start_date,
    'accounts_count', t.accounts_count,
    'total_bets_pass', t.bets_pass,
    'total_deleted_pass', t.deleted_pass,
    'total_pass', t.pass,
    'total_successes', 0::NUMERIC(12,2),
    'total_commission', t.commission,
    'total_claims', t.claims,
    'total_bills', 0::NUMERIC(12,2),
    'total_revenue', t.subtotal,
    'total_subtotal', t.subtotal,
    'total_previous_balance', 0::NUMERIC(12,2),
    'total_collections', t.collections,
    'total_paid', t.paid,
    'total_total', t.total,
    'total_expenses', x.expenses,
    'net_balance', (t.collections - t.paid - x.expenses)::NUMERIC(12,2)
  )
  FROM polla_editions e
  CROSS JOIN LATERAL (
    SELECT
      (count(*) FILTER (WHERE b.bets_pass <> 0 OR b.deleted_pass <> 0 OR b.claims <> 0
                          OR b.collections <> 0 OR b.paid <> 0))::INTEGER AS accounts_count,
      COALESCE(SUM(b.bets_pass), 0)::NUMERIC(12,2) AS bets_pass,
      COALESCE(SUM(b.deleted_pass), 0)::NUMERIC(12,2) AS deleted_pass,
      COALESCE(SUM(b.pass), 0)::NUMERIC(12,2) AS pass,
      COALESCE(SUM(b.cashier_commission), 0)::NUMERIC(12,2) AS commission,
      COALESCE(SUM(b.claims), 0)::NUMERIC(12,2) AS claims,
      COALESCE(SUM(b.subtotal), 0)::NUMERIC(12,2) AS subtotal,
      COALESCE(SUM(b.collections), 0)::NUMERIC(12,2) AS collections,
      COALESCE(SUM(b.paid), 0)::NUMERIC(12,2) AS paid,
      COALESCE(SUM(b.total), 0)::NUMERIC(12,2) AS total
    FROM polla_edition_account_base(e.polla_organization_id, e.polla_edition_id, p_group_id) b
  ) t
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(x.amount), 0)::NUMERIC(12,2) AS expenses
    FROM polla_org_expenses x
    WHERE x.polla_organization_id = e.polla_organization_id
      AND x.polla_edition_id = e.polla_edition_id
      AND (p_group_id IS NULL OR x.polla_group_id = p_group_id)
  ) x
  WHERE e.polla_organization_id = p_organization_id
    AND e.polla_edition_id = ANY (p_edition_ids)
  ORDER BY e.start_date DESC;
$$;

-- ============================================================
-- 7. Ediciones del pasador
-- ============================================================

-- Solo las ediciones donde el pasador tiene liquidación: su cuenta usa los
-- tickets de la liquidación y los movimientos en vivo.
CREATE FUNCTION polla_user_edition_accounts(p_organization_id UUID, p_user_id UUID)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'polla_edition_id', e.polla_edition_id,
    'account', (
      SELECT r FROM polla_edition_account_rows(p_organization_id, e.polla_edition_id, NULL, p_user_id) r
    )
  )
  FROM polla_editions e
  WHERE e.polla_organization_id = p_organization_id
    AND e.account_by_edition
    AND e.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM polla_edition_liquidations l
      WHERE l.polla_edition_id = e.polla_edition_id
        AND l.polla_organization_id = p_organization_id
        AND l.polla_user_id = p_user_id
    )
  ORDER BY e.start_date DESC;
$$;

-- ============================================================
-- 8. Permisos
-- ============================================================

REVOKE ALL ON FUNCTION polla_edition_account_base(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_account_base(UUID, UUID, UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_edition_account_rows(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_account_rows(UUID, UUID, UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_liquidate_edition_accounts(UUID, UUID, UUID[], UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_liquidate_edition_accounts(UUID, UUID, UUID[], UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION polla_set_edition_liquidated(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_set_edition_liquidated(UUID, UUID, UUID, BOOLEAN) TO service_role;
REVOKE ALL ON FUNCTION polla_edition_account_list(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_account_list(UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_edition_account_totals(UUID, UUID[], UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_account_totals(UUID, UUID[], UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_user_edition_accounts(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_user_edition_accounts(UUID, UUID) TO service_role;

-- ROLLBACK:
-- DROP FUNCTION polla_user_edition_accounts(UUID, UUID);
-- DROP FUNCTION polla_edition_account_totals(UUID, UUID[], UUID);
-- DROP FUNCTION polla_edition_account_list(UUID);
-- DROP FUNCTION polla_set_edition_liquidated(UUID, UUID, UUID, BOOLEAN);
-- DROP FUNCTION polla_liquidate_edition_accounts(UUID, UUID, UUID[], UUID, TEXT);
-- DROP FUNCTION polla_edition_account_rows(UUID, UUID, UUID, UUID);
-- DROP FUNCTION polla_edition_account_base(UUID, UUID, UUID, UUID);
