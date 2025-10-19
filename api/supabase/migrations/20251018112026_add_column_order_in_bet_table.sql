ALTER TABLE public.bets
ADD COLUMN bet_order INTEGER DEFAULT 0;

CREATE INDEX idx_bets_ticket_order ON public.bets (ticket_id, bet_order ASC);