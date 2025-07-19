ALTER TABLE bets
ALTER COLUMN number TYPE text USING number::text;
