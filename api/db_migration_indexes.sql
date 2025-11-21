-- ============================================================================
-- MIGRACIÓN DE ÍNDICES - QuiniApp Database
-- ============================================================================
-- Fecha: 2025-11-21
-- Objetivo: Optimizar performance basado en análisis de queries reales
--
-- IMPORTANTE:
-- - Usar CONCURRENTLY en producción para no bloquear tablas
-- - Ejecutar en horario de bajo tráfico
-- - Hacer backup antes de ejecutar
-- - Monitorear espacio en disco durante creación
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1: ÍNDICES A ELIMINAR (sin uso, desperdician espacio)
-- ============================================================================

-- Eliminar índice sin uso en ticket_prizes_by_turn
-- Ahorra: 16 KB
DROP INDEX IF EXISTS idx_tpt_ticket;

-- NOTA: Los índices unique_number_when_not_deleted y unique_username_not_deleted
-- en la tabla users tienen 0 usos, pero podrían ser constraints de unicidad.
-- Verificar con el equipo antes de eliminar.
-- Si se confirma que son solo constraints y no se consultan:
-- DROP INDEX IF EXISTS unique_number_when_not_deleted;
-- DROP INDEX IF EXISTS unique_username_not_deleted;

-- ============================================================================
-- SECCIÓN 2: ÍNDICES CRÍTICOS PARA TICKETS
-- ============================================================================

-- Índice 1: Queries más frecuentes - tickets por fecha
-- Usado en: TicketRepository.getAll(), getAllTicketNumber(), getAllDeletedTickets()
-- Query típica: SELECT * FROM tickets WHERE date = ? AND deleted_at IS NULL
-- Beneficio esperado: 60-80% más rápido en queries por fecha
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_date_deleted_winner_created
ON tickets(date DESC, deleted_at, winner, created_at DESC)
WHERE deleted_at IS NULL;

-- Índice 2: Queries filtradas por usuario
-- Usado en: TicketRepository.getAll(), getAllTicketNumber() con user_id
-- Query típica: SELECT * FROM tickets WHERE user_id = ? AND date = ? AND deleted_at IS NULL
-- Beneficio esperado: 70-90% más rápido en queries de usuario por fecha
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_user_date_deleted_created
ON tickets(user_id, date DESC, deleted_at, created_at DESC)
WHERE deleted_at IS NULL;

-- Índice 3: Ganadores sin filtro de fecha
-- Usado en: WinnerRepository.getAllWinners()
-- Query típica: SELECT * FROM tickets WHERE winner = true AND deleted_at IS NULL
-- Beneficio esperado: 80-95% más rápido en lista de ganadores
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_winner_deleted_created
ON tickets(winner, deleted_at, created_at DESC)
WHERE winner = true AND deleted_at IS NULL;

-- Índice 4: Ganadores por usuario
-- Usado en: WinnerRepository.getAllWinners() con user_id
-- Query típica: SELECT * FROM tickets WHERE winner = true AND deleted_at IS NULL AND user_id = ?
-- Beneficio esperado: 85-95% más rápido
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_winner_user_deleted_created
ON tickets(winner, user_id, deleted_at, created_at DESC)
WHERE winner = true AND deleted_at IS NULL;

-- ============================================================================
-- SECCIÓN 3: ÍNDICES PARA BETS (Mejoras incrementales)
-- ============================================================================

-- Índice 1: Ganadores por fecha
-- Usado en: BetRepository.getWinnerBets()
-- Query típica: SELECT * FROM bets WHERE date = ? AND winner = true AND deleted_at IS NULL
-- Nota: Ya existe idx_bets_schedule_date pero no incluye winner ni deleted_at
-- Beneficio esperado: 40-60% más rápido en queries de ganadores
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_date_winner_deleted_created
ON bets(date DESC, winner, deleted_at, created_at DESC)
WHERE winner = true AND deleted_at IS NULL;

-- Índice 2: Ganadores por schedule
-- Usado en: BetRepository.getWinnerBets() con schedule_id
-- Query típica: SELECT * FROM bets WHERE date = ? AND winner = true AND schedule_id = ? AND deleted_at IS NULL
-- Beneficio esperado: 50-70% más rápido
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_date_schedule_winner_deleted
ON bets(date DESC, schedule_id, winner, deleted_at)
WHERE winner = true AND deleted_at IS NULL;

-- Índice 3: Bets por usuario y fecha
-- Usado en: BetRepository.getAllBets() con cashier_id
-- Query típica: SELECT * FROM bets WHERE date = ? AND user_id = ? AND deleted_at IS NULL
-- Beneficio esperado: 30-50% más rápido
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_user_date_deleted
ON bets(user_id, date DESC, deleted_at)
WHERE deleted_at IS NULL;

-- ============================================================================
-- SECCIÓN 4: ÍNDICES OPCIONALES (Evaluar después de monitoring)
-- ============================================================================

-- Índice para bets por lottery_id y fecha
-- Solo crear si se observa uso frecuente de esta combinación
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_lottery_date_deleted
-- ON bets(lottery_id, date DESC, deleted_at)
-- WHERE deleted_at IS NULL;

-- Índice para tickets eliminados (si se necesita reportería)
-- Solo crear si hay queries frecuentes a tickets eliminados
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_deleted_at_date
-- ON tickets(deleted_at, date DESC)
-- WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- SECCIÓN 5: ANÁLISIS DE REDUNDANCIA EN RESULTS
-- ============================================================================

-- INVESTIGAR: Posible redundancia entre estos dos índices:
-- - idx_results_schedule_date (5,513 usos) ← MUY USADO
-- - idx_results_schedule_id_date (81 usos) ← POCO USADO
--
-- Ejecutar para comparar:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE indexname IN ('idx_results_schedule_date', 'idx_results_schedule_id_date');
--
-- Si son idénticos, eliminar el menos usado:
-- DROP INDEX IF EXISTS idx_results_schedule_id_date;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================

-- Verificar que los índices se crearon correctamente
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as tamaño,
  indexdef
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE schemaname = 'public'
  AND (
    indexname LIKE 'idx_tickets_%' OR
    indexname LIKE 'idx_bets_%'
  )
ORDER BY tablename, indexname;

-- Verificar espacio ocupado por tabla después de índices
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as tamaño_total,
  pg_size_pretty(pg_relation_size('public.'||tablename)) as tamaño_datos,
  pg_size_pretty(pg_total_relation_size('public.'||tablename) -
                 pg_relation_size('public.'||tablename)) as tamaño_indices
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tickets', 'bets')
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- ============================================================================
-- ROLLBACK PLAN (si algo sale mal)
-- ============================================================================

-- Para revertir todos los cambios, ejecutar en orden inverso:
/*
DROP INDEX IF EXISTS idx_bets_user_date_deleted;
DROP INDEX IF EXISTS idx_bets_date_schedule_winner_deleted;
DROP INDEX IF EXISTS idx_bets_date_winner_deleted_created;
DROP INDEX IF EXISTS idx_tickets_winner_user_deleted_created;
DROP INDEX IF EXISTS idx_tickets_winner_deleted_created;
DROP INDEX IF EXISTS idx_tickets_user_date_deleted_created;
DROP INDEX IF EXISTS idx_tickets_date_deleted_winner_created;

-- Recrear índice eliminado si fue necesario
CREATE INDEX idx_tpt_ticket ON ticket_prizes_by_turn(ticket_id);
*/

-- ============================================================================
-- BENCHMARK QUERIES (ejecutar ANTES y DESPUÉS)
-- ============================================================================

-- Query 1: Tickets del día
EXPLAIN ANALYZE
SELECT * FROM tickets
WHERE date = CURRENT_DATE
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 100;

-- Query 2: Tickets ganadores
EXPLAIN ANALYZE
SELECT * FROM tickets
WHERE winner = true
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 100;

-- Query 3: Tickets de un usuario por fecha
EXPLAIN ANALYZE
SELECT * FROM tickets
WHERE user_id = 'uuid-ejemplo'
  AND date = CURRENT_DATE
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- Query 4: Bets ganadores del día
EXPLAIN ANALYZE
SELECT * FROM bets
WHERE date = CURRENT_DATE
  AND winner = true
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 100;

-- Query 5: Bets de un usuario
EXPLAIN ANALYZE
SELECT * FROM bets
WHERE user_id = 'uuid-ejemplo'
  AND date = CURRENT_DATE
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- ============================================================================
-- NOTAS FINALES
-- ============================================================================
--
-- 1. TIMING: Ejecutar en horario de bajo tráfico (madrugada)
--
-- 2. MONITORING: Monitorear por 48-72 horas después:
--    - Tiempos de respuesta de endpoints
--    - Uso de CPU/memoria
--    - Espacio en disco
--    - Hit rate de índices nuevos
--
-- 3. PRÓXIMOS PASOS:
--    - Ejecutar purga de ticket_prizes_by_turn (FASE 1, Día 5)
--    - Implementar reportes básicos (FASE 2)
--    - Configurar monitoring de performance
--
-- 4. CONTACTO: Si hay problemas, revertir con el ROLLBACK PLAN
--
-- ============================================================================
