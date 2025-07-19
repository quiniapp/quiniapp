ALTER TABLE bets
ALTER COLUMN ticket_number TYPE text USING number::text;
