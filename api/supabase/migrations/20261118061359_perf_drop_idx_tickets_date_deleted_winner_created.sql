-- Rendimiento SQL, Fase 1c (docs/plan-rendimiento-sql.md, docs/rendimiento-sql-baseline.md):
-- drop de idx_tickets_date_deleted_winner_created, sin uso.
-- tickets(date DESC, deleted_at, winner, created_at DESC) WHERE deleted_at IS NULL. 0 usos en el delta de 24 h. Los listados de tickets usan idx_tickets_org_date_feed (Fase 1) e idx_tickets_user_date_deleted_created (modo grupo).
-- Cada carga de ticket mantenía este índice.
-- Si hiciera falta volver atrás: la definición original está en la migración que lo creó.
--
-- CONCURRENTLY como ÚNICA sentencia del archivo (ver CLAUDE.md, "SQL Performance").
DROP INDEX CONCURRENTLY IF EXISTS public.idx_tickets_date_deleted_winner_created;
