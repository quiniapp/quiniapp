-- Backfill de polla_bets.ticket_number para filas cargadas antes de que la
-- columna existiera (20260920100500_add_ticket_number_to_polla_bets.sql).
-- Sin esto, esas jugadas viejas no se pueden buscar por ticket_number
-- (Revisar Ticket) y rompen cualquier sort/display que asuma non-null.

UPDATE polla_bets pb
SET ticket_number = t.ticket_number
FROM tickets t
WHERE t.ticket_id = pb.ticket_id
  AND pb.ticket_number IS NULL;
