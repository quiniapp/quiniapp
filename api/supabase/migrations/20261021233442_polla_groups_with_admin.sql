-- Polla: el grupo funciona como una organización chica con su admin.
--
-- * Cada grupo tiene un solo admin y se crean juntos
--   (polla_create_group_with_admin), igual que la organización con su
--   capitalista. Un admin sin grupo (los del modelo anterior) no opera hasta
--   que un superadmin o superior lo asigna a un grupo sin admin.
-- * El grupo del pasador queda fijo al crearlo: nunca se cambia de grupo. El
--   admin solo se puede asignar a un grupo si todavía no tenía uno.
-- * El jugador toma el grupo de su pasador. Cambiar de pasador solo se puede
--   dentro del mismo grupo.

-- ============================================================
-- 1. Un admin por grupo
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS unique_polla_group_admin_active
  ON polla_users (polla_group_id)
  WHERE user_type = 'ADMIN' AND deleted_at IS NULL AND polla_group_id IS NOT NULL;

-- ============================================================
-- 2. Grupo fijo del pasador y del admin, grupo heredado del jugador
-- ============================================================

DROP TRIGGER IF EXISTS trg_sync_polla_user_group ON polla_users;
DROP FUNCTION IF EXISTS sync_polla_user_group();

CREATE FUNCTION sync_polla_user_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent_group UUID;
BEGIN
  IF NEW.user_type = 'PLAYER' THEN
    SELECT polla_group_id INTO v_parent_group
    FROM polla_users
    WHERE polla_user_id = NEW.parent_polla_user_id;

    -- Cambiar de pasador, solo a otro del mismo grupo.
    IF TG_OP = 'UPDATE'
       AND NEW.parent_polla_user_id IS DISTINCT FROM OLD.parent_polla_user_id
       AND v_parent_group IS DISTINCT FROM OLD.polla_group_id THEN
      RAISE EXCEPTION 'POLLA_PARENT_OTHER_GROUP';
    END IF;

    NEW.polla_group_id := v_parent_group;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.polla_group_id IS DISTINCT FROM OLD.polla_group_id THEN
    -- El admin del modelo anterior se asigna una sola vez; el pasador nunca.
    IF NEW.user_type = 'ADMIN' AND OLD.polla_group_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.user_type IN ('ADMIN', 'CASHIER') THEN
      RAISE EXCEPTION 'POLLA_USER_GROUP_LOCKED';
    END IF;
  END IF;

  -- Los roles de la organización no van en un grupo.
  IF NEW.user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN') THEN
    NEW.polla_group_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Corre antes que trg_validate_polla_user_group (orden alfabético), así esa
-- valida el grupo ya resuelto.
CREATE TRIGGER trg_sync_polla_user_group
  BEFORE INSERT OR UPDATE OF parent_polla_user_id, polla_group_id, user_type ON polla_users
  FOR EACH ROW EXECUTE FUNCTION sync_polla_user_group();

-- Jugadores existentes: el grupo de su pasador.
UPDATE polla_users p
SET polla_group_id = c.polla_group_id,
    edited_at = NOW()
FROM polla_users c
WHERE p.user_type = 'PLAYER'
  AND c.polla_user_id = p.parent_polla_user_id
  AND p.polla_group_id IS DISTINCT FROM c.polla_group_id;

-- ============================================================
-- 3. Alta de un grupo junto con su admin
-- ============================================================

DROP FUNCTION IF EXISTS polla_create_group_with_admin(UUID, TEXT, JSONB);

CREATE FUNCTION polla_create_group_with_admin(
  p_organization_id UUID,
  p_name TEXT,
  p_admin JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_group polla_groups;
  v_admin_id UUID;
BEGIN
  INSERT INTO polla_groups (polla_organization_id, name)
  VALUES (p_organization_id, p_name)
  RETURNING * INTO v_group;

  INSERT INTO polla_users (
    user_type,
    name,
    last_name,
    username,
    email,
    phone,
    password_hash,
    password_changed_at,
    polla_organization_id,
    polla_group_id
  ) VALUES (
    'ADMIN',
    p_admin->>'name',
    NULLIF(p_admin->>'last_name', ''),
    p_admin->>'username',
    NULLIF(p_admin->>'email', ''),
    (p_admin->>'phone')::BIGINT,
    p_admin->>'password_hash',
    NOW(),
    p_organization_id,
    v_group.polla_group_id
  )
  RETURNING polla_user_id INTO v_admin_id;

  RETURN jsonb_build_object(
    'group', to_jsonb(v_group),
    'admin_polla_user_id', v_admin_id
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_create_group_with_admin(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_create_group_with_admin(UUID, TEXT, JSONB) TO service_role;
