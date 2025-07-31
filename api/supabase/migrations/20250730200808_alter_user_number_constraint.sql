-- 1. Eliminar la restricción UNIQUE existente en "number"
ALTER TABLE users DROP CONSTRAINT users_number_key;

-- 2. Crear un índice único parcial donde deleted_at sea NULL
CREATE UNIQUE INDEX unique_number_when_not_deleted
ON users (number)
WHERE deleted_at IS NULL;