-- Rendimiento SQL, Fase 1: keyset de GET /ticket en días archivados.
-- Única sentencia del archivo (ver CLAUDE.md, "SQL Performance").
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_archive_org_date_feed
  ON public.tickets_archive (organization_id, date, created_at DESC, ticket_id DESC)
  WHERE deleted_at IS NULL;
