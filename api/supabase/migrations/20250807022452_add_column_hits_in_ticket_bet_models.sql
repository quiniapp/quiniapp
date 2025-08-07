-- Agregar columna 'hits' a 'bets'
alter table bets
add column hits integer not null default 0;

-- Agregar columna 'hits' a 'tickets'
alter table tickets
add column hits integer not null default 0;
