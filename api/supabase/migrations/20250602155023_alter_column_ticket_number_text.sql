-- Asegurarse de que todos los valores actuales se puedan convertir a texto
-- (en realidad todos los INTEGER ya lo son, pero este paso es solo de contexto)

-- Cambiar el tipo de la columna ticket_number de INTEGER a TEXT
ALTER TABLE tickets
ALTER COLUMN ticket_number TYPE TEXT
USING ticket_number::TEXT;

ALTER TABLE tickets
ADD CONSTRAINT ticket_number_numeric_only CHECK (ticket_number ~ '^\d+$');
