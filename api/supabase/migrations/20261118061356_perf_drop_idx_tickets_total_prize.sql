-- Rendimiento SQL, Fase 1c (docs/plan-rendimiento-sql.md, docs/rendimiento-sql-baseline.md):
-- drop de idx_tickets_total_prize, sin uso.
-- tickets(total_prize). 0 usos en 14 meses (prod). total_prize lo actualiza generate_winners: el índice además impide updates HOT.
-- Cada carga de ticket mantenía este índice.
-- Si hiciera falta volver atrás: la definición original está en la migración que lo creó.
--
-- CONCURRENTLY como ÚNICA sentencia del archivo (ver CLAUDE.md, "SQL Performance").
DROP INDEX CONCURRENTLY IF EXISTS public.idx_tickets_total_prize;
