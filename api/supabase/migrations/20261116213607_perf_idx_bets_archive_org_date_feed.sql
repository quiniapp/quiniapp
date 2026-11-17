-- Rendimiento SQL, Fase 1: keyset de GET /bet en días archivados. Hoy ningún
-- índice de bets_archive empieza por organization_id (entra por date y filtra
-- la organización). bets_archive es la tabla más grande (~1 GB en prod):
-- CONCURRENTLY evita bloquear el archivado mientras se construye.
-- Única sentencia del archivo (ver CLAUDE.md, "SQL Performance").
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_archive_org_date_feed
  ON public.bets_archive (organization_id, date, created_at DESC, bet_order, bet_id)
  WHERE deleted_at IS NULL;
