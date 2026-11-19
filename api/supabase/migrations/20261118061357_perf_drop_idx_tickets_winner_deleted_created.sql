-- Rendimiento SQL, Fase 1c (docs/plan-rendimiento-sql.md, docs/rendimiento-sql-baseline.md):
-- drop de idx_tickets_winner_deleted_created, sin uso.
-- tickets(winner, deleted_at, created_at DESC) WHERE winner AND deleted_at IS NULL. 2 usos en 14 meses y 0 en el delta de 24 h. winner lo actualiza generate_winners.
-- Cada carga de ticket mantenía este índice.
-- Si hiciera falta volver atrás: la definición original está en la migración que lo creó.
--
-- CONCURRENTLY como ÚNICA sentencia del archivo (ver CLAUDE.md, "SQL Performance").
DROP INDEX CONCURRENTLY IF EXISTS public.idx_tickets_winner_deleted_created;
