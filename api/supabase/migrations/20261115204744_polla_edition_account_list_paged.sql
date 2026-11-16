-- Lista de ediciones de la cuenta corriente: filtros, paginado y contadores.
--
-- * Filtros: liquidadas o no (`p_liquidated`), rango de inicio (`p_from`,
--   `p_to`) y página (`p_limit`, `p_offset`). "Liquidaciones realizadas" se
--   pide de a páginas (scroll infinito) y la cuenta se calcula solo para las
--   ediciones de la página. Cada fila trae `total_count`: cuántas hay con
--   esos filtros, sin contar la página.
-- * `p_with_counts = FALSE` no calcula la cuenta (contadores en NULL): lo usan
--   los selectores de edición (Grupos, reportes de varias ediciones).
-- * Contadores: los dos cuentan solo a los pasadores con jugadas, borradas o
--   movimientos. Antes, un pasador liquidado en cero sumaba a los liquidados
--   pero no al total, y podía quedar "52 de 1".
-- * El Debe se separa: `owed_by_cashiers` (lo que deben los pasadores) y
--   `owed_to_cashiers` (lo que hay que pagarles), sin compensar. Reemplaza a
--   `owed`, que era la suma neta.

DROP FUNCTION IF EXISTS polla_edition_account_list(UUID);

CREATE FUNCTION polla_edition_account_list(
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
           -- Total con los filtros, sin la página (la ventana se calcula antes del LIMIT).
           count(*) OVER () AS total_count
    FROM polla_editions e
    WHERE e.polla_organization_id = p_organization_id
      AND e.account_by_edition
      AND e.deleted_at IS NULL
      AND polla_now() >= polla_edition_load_close(e)
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

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS polla_edition_account_list(UUID, BOOLEAN, DATE, DATE, BOOLEAN, INTEGER, INTEGER);
-- Volver a crear `polla_edition_account_list(UUID)` con su definición anterior:
-- 20261115124454_polla_staff_load_until_draw.sql (con sus REVOKE y GRANT).
