BEGIN;

-- Eliminar la FK duplicada entre bets.ticket_id y tickets.ticket_id
ALTER TABLE public.bets
  DROP CONSTRAINT IF EXISTS fk_bet_ticket;

-- (Opcional) Asegurar índice para performance de la cascada
CREATE INDEX IF NOT EXISTS idx_bets_ticket_id ON public.bets(ticket_id);

COMMIT;
