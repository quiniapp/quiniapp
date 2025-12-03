-- ============================================================================
-- SECCIÓN 2: ÍNDICES CRÍTICOS PARA TICKETS
-- ============================================================================

-- Índice 1: Queries más frecuentes - tickets por fecha
-- Usado en: TicketRepository.getAll(), getAllTicketNumber(), getAllDeletedTickets()
-- Query típica: SELECT * FROM tickets WHERE date = ? AND deleted_at IS NULL
-- Beneficio esperado: 60-80% más rápido en queries por fecha
CREATE INDEX  IF NOT EXISTS idx_tickets_date_deleted_winner_created
ON tickets(date DESC, deleted_at, winner, created_at DESC)
WHERE deleted_at IS NULL;

-- Índice 2: Queries filtradas por usuario
-- Usado en: TicketRepository.getAll(), getAllTicketNumber() con user_id
-- Query típica: SELECT * FROM tickets WHERE user_id = ? AND date = ? AND deleted_at IS NULL
-- Beneficio esperado: 70-90% más rápido en queries de usuario por fecha
CREATE INDEX  IF NOT EXISTS idx_tickets_user_date_deleted_created
ON tickets(user_id, date DESC, deleted_at, created_at DESC)
WHERE deleted_at IS NULL;

-- Índice 3: Ganadores sin filtro de fecha
-- Usado en: WinnerRepository.getAllWinners()
-- Query típica: SELECT * FROM tickets WHERE winner = true AND deleted_at IS NULL
-- Beneficio esperado: 80-95% más rápido en lista de ganadores
CREATE INDEX  IF NOT EXISTS idx_tickets_winner_deleted_created
ON tickets(winner, deleted_at, created_at DESC)
WHERE winner = true AND deleted_at IS NULL;

-- Índice 4: Ganadores por usuario
-- Usado en: WinnerRepository.getAllWinners() con user_id
-- Query típica: SELECT * FROM tickets WHERE winner = true AND deleted_at IS NULL AND user_id = ?
-- Beneficio esperado: 85-95% más rápido
CREATE INDEX  IF NOT EXISTS idx_tickets_winner_user_deleted_created
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
CREATE INDEX  IF NOT EXISTS idx_bets_date_winner_deleted_created
ON bets(date DESC, winner, deleted_at, created_at DESC)
WHERE winner = true AND deleted_at IS NULL;

-- Índice 2: Ganadores por schedule
-- Usado en: BetRepository.getWinnerBets() con schedule_id
-- Query típica: SELECT * FROM bets WHERE date = ? AND winner = true AND schedule_id = ? AND deleted_at IS NULL
-- Beneficio esperado: 50-70% más rápido
CREATE INDEX  IF NOT EXISTS idx_bets_date_schedule_winner_deleted
ON bets(date DESC, schedule_id, winner, deleted_at)
WHERE winner = true AND deleted_at IS NULL;

-- Índice 3: Bets por usuario y fecha
-- Usado en: BetRepository.getAllBets() con cashier_id
-- Query típica: SELECT * FROM bets WHERE date = ? AND user_id = ? AND deleted_at IS NULL
-- Beneficio esperado: 30-50% más rápido
CREATE INDEX  IF NOT EXISTS idx_bets_user_date_deleted
ON bets(user_id, date DESC, deleted_at)
WHERE deleted_at IS NULL;

