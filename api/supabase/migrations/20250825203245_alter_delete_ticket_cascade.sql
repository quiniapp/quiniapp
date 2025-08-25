-- 1. Asegurar que ticket_id exista y sea NOT NULL (opcional si ya lo es)
alter table public.bets
  alter column ticket_id set not null;

-- 2. Index para performance de la cascada (si no existe)
create index if not exists idx_bets_ticket_id on public.bets(ticket_id);

-- 3. Re-crear la FK con ON DELETE CASCADE
alter table public.bets
  drop constraint if exists bets_ticket_id_fkey;

alter table public.bets
  add constraint bets_ticket_id_fkey
  foreign key (ticket_id)
  references public.tickets(ticket_id)
  on delete cascade
  on update no action;
