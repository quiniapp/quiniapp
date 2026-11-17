-- Rendimiento SQL, Fase 1: keyset de GET /ticket. Igualdad (organization_id,
-- date) + ORDER BY (created_at DESC, ticket_id DESC). Reemplaza a
-- idx_tickets_date_org_active (se dropea en la Fase 6, después de medir).
-- Única sentencia del archivo (ver CLAUDE.md, "SQL Performance").
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_org_date_feed
  ON public.tickets (organization_id, date, created_at DESC, ticket_id DESC)
  WHERE deleted_at IS NULL;
