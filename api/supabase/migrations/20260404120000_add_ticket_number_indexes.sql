-- Add indexes on ticket_number for fast lookup by number
-- tickets(ticket_number) already has a UNIQUE constraint (implicit index)
-- tickets_archive, bets, bets_archive are missing these indexes

-- tickets_archive: enables fast getByNumber lookup in archive
CREATE INDEX IF NOT EXISTS idx_tickets_archive_ticket_number
ON tickets_archive(ticket_number, organization_id);

-- bets: enables fast get_ticket_sums() filtering by ticket_number
CREATE INDEX IF NOT EXISTS idx_bets_ticket_number
ON bets(ticket_number) WHERE deleted_at IS NULL;

-- bets_archive: enables fast get_ticket_sums_archive() filtering by ticket_number
CREATE INDEX IF NOT EXISTS idx_bets_archive_ticket_number
ON bets_archive(ticket_number);
