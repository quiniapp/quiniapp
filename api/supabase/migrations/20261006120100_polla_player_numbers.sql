-- Polla: los jugadores también tienen número.
--
-- Para cargar una jugada a nombre de otro se escribe su número y se trae el
-- usuario, así que pasadores y jugadores necesitan uno (único dentro de la
-- organización, como ya pasaba con los pasadores). Los jugadores que existían
-- sin número (y algún pasador que haya quedado sin uno) reciben los siguientes
-- libres de su organización, por orden de alta.

WITH numbered AS (
  SELECT
    u.polla_user_id,
    COALESCE(
      (SELECT MAX(o.number)
       FROM polla_users o
       WHERE o.polla_organization_id = u.polla_organization_id
         AND o.deleted_at IS NULL),
      0
    ) + ROW_NUMBER() OVER (PARTITION BY u.polla_organization_id ORDER BY u.created_at, u.polla_user_id)
      AS new_number
  FROM polla_users u
  WHERE u.user_type IN ('CASHIER', 'PLAYER')
    AND u.number IS NULL
    AND u.deleted_at IS NULL
)
UPDATE polla_users u
SET number = n.new_number,
    edited_at = NOW()
FROM numbered n
WHERE u.polla_user_id = n.polla_user_id;

-- Los borrados no entran en el índice único, así que no necesitan número.
ALTER TABLE polla_users
  ADD CONSTRAINT polla_users_number_required CHECK (
    user_type NOT IN ('CASHIER', 'PLAYER')
    OR deleted_at IS NOT NULL
    OR number IS NOT NULL
  );
