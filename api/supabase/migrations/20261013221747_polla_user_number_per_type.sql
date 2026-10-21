-- Polla: el número de usuario es único por tipo dentro de la organización.
--
-- Hasta ahora el número era único entre todos los usuarios activos de la
-- organización, así que un pasador y un jugador no podían compartirlo. Ahora
-- cada tipo tiene su propia numeración: el pasador elige el número de su
-- jugador sin chocar con los números de los pasadores.
--
-- Los datos actuales ya son únicos por organización (y por lo tanto por
-- organización y tipo): no hace falta backfill. El índice conserva el nombre
-- porque la API traduce el error por ese nombre (`polla-errors.ts`).

DROP INDEX IF EXISTS unique_polla_user_number_active;

CREATE UNIQUE INDEX unique_polla_user_number_active
  ON polla_users (polla_organization_id, user_type, number)
  WHERE deleted_at IS NULL AND number IS NOT NULL;
