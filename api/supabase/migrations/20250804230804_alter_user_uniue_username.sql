-- 1. Eliminar la restricción UNIQUE existente
ALTER TABLE users DROP CONSTRAINT users_username_key;

-- 2. Crear índice único parcial (solo si deleted_at IS NULL)
CREATE UNIQUE INDEX unique_username_not_deleted ON users (username) WHERE deleted_at IS NULL;
