-- Agregar campo 'prize' a la tabla 'bets'
ALTER TABLE bets
ADD COLUMN prize NUMERIC DEFAULT 0;

-- Agregar campo 'total_prize' a la tabla 'tickets'
ALTER TABLE tickets
ADD COLUMN total_prize NUMERIC DEFAULT 0;
