-- Rendimiento SQL, Fase 1 (docs/plan-rendimiento-sql.md): keyset de GET /bet.
-- Índice alineado con el listado: igualdad (organization_id, date) + ORDER BY
-- (created_at DESC, bet_order, bet_id) con desempate único. El listado pagina
-- con cursor sin ordenar en memoria. Reemplaza a idx_bets_org_date_active
-- (se dropea en la Fase 6, después de medir).
--
-- CONCURRENTLY como ÚNICA sentencia del archivo: la Supabase CLI corre cada
-- migración como pipeline y dos o más sentencias con CONCURRENTLY fallan
-- (ver CLAUDE.md, "SQL Performance"). Verificar después pg_index.indisvalid.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_org_date_feed
  ON public.bets (organization_id, date, created_at DESC, bet_order, bet_id)
  WHERE deleted_at IS NULL;
