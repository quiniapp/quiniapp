-- Pestaña Grupos de la cuenta corriente: todos los grupos en una consulta.
--
-- Antes la API pedía `polla_group_edition_account_preview` una vez por grupo
-- (en paralelo), cada una recalculaba la cuenta de toda la edición, y traía
-- hasta 100 grupos. `polla_group_edition_account_previews` devuelve lo mismo
-- para todos los grupos de la organización (ordenados por nombre), calculando
-- la cuenta de la edición una sola vez.
--
-- `polla_group_edition_account_preview` (un grupo) queda: la usan la
-- liquidación del grupo y el borrado.

CREATE FUNCTION polla_group_edition_account_previews(
  p_organization_id UUID,
  p_edition_id UUID
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
BEGIN
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

  RETURN QUERY
  WITH
  -- Liquidación vigente de cada pasador (la más nueva); cuenta en el grupo que
  -- quedó guardado en ella, aunque el pasador haya cambiado de grupo después.
  liqs AS (
    SELECT DISTINCT ON (l.polla_user_id) l.polla_group_id, l.subtotal
    FROM polla_edition_liquidations l
    WHERE l.polla_edition_id = p_edition_id
      AND l.polla_organization_id = p_organization_id
    ORDER BY l.polla_user_id, l.created_at DESC, l.polla_edition_liquidation_id DESC
  ),
  subtotals AS (
    SELECT q.polla_group_id, SUM(q.subtotal) AS subtotal
    FROM liqs q
    WHERE q.polla_group_id IS NOT NULL
    GROUP BY q.polla_group_id
  ),
  expenses AS (
    SELECT x.polla_group_id, SUM(x.amount) AS amount
    FROM polla_org_expenses x
    WHERE x.polla_organization_id = p_organization_id
      AND x.polla_edition_id = p_edition_id
      AND x.polla_group_id IS NOT NULL
    GROUP BY x.polla_group_id
  ),
  -- Pasadores que hoy están en el grupo, con movimiento y sin liquidación vigente.
  pending AS (
    SELECT b.live_group_id AS polla_group_id,
           jsonb_agg(jsonb_build_object(
             'polla_user_id', b.polla_user_id,
             'name', b.user_name,
             'number', b.user_number
           ) ORDER BY b.user_number NULLS LAST, b.user_name) AS list
    FROM polla_edition_account_base(p_organization_id, p_edition_id) b
    WHERE b.liquidation_id IS NULL
      AND b.live_group_id IS NOT NULL
      AND (b.bets_pass <> 0 OR b.deleted_pass <> 0 OR b.claims <> 0
           OR b.collections <> 0 OR b.paid <> 0)
    GROUP BY b.live_group_id
  )
  SELECT jsonb_build_object(
    'polla_group_id', g.polla_group_id,
    'group_name', g.name,
    'polla_edition_id', p_edition_id,
    'cashiers_subtotal', COALESCE(s.subtotal, 0)::NUMERIC(12,2),
    'expenses', COALESCE(x.amount, 0)::NUMERIC(12,2),
    'base', (COALESCE(s.subtotal, 0) - COALESCE(x.amount, 0))::NUMERIC(12,2),
    'pending_cashiers', COALESCE(p.list, '[]'::JSONB),
    'account', CASE WHEN a.polla_group_edition_account_id IS NULL THEN NULL ELSE to_jsonb(a) END
  )
  FROM polla_groups g
  LEFT JOIN subtotals s ON s.polla_group_id = g.polla_group_id
  LEFT JOIN expenses x ON x.polla_group_id = g.polla_group_id
  LEFT JOIN pending p ON p.polla_group_id = g.polla_group_id
  LEFT JOIN polla_group_edition_accounts a
    ON a.polla_group_id = g.polla_group_id AND a.polla_edition_id = p_edition_id
  WHERE g.polla_organization_id = p_organization_id
    AND g.deleted_at IS NULL
  ORDER BY g.name, g.polla_group_id;
END;
$$;

REVOKE ALL ON FUNCTION polla_group_edition_account_previews(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_group_edition_account_previews(UUID, UUID) TO service_role;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS polla_group_edition_account_previews(UUID, UUID);
