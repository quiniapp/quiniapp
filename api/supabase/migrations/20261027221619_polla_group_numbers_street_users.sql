-- Polla: números por grupo, tickets con grupo/pasador/jugador, usuarios de
-- calle, identificador en el ticket y el rol Super (ASSISTANT).
--
-- * Cada grupo tiene un número (1 a N dentro de la organización; el 0 es "sin
--   grupo"). Los números de pasador son únicos dentro de su grupo (los sin
--   grupo, únicos entre ellos) y los de jugador, dentro de su pasador: se
--   repiten entre grupos y entre pasadores.
-- * Para que el ticket siga siendo único lleva todo:
--   {grupo}-{YYYYMMDDHHmmssSSS}-{pasador}-{jugador}. El jugador es 0 si la
--   jugada es del propio pasador. Los tickets viejos no se reescriben.
-- * Pasadores y jugadores de calle: sin usuario ni contraseña, no entran a la
--   aplicación; sirven para saber de quién son los tickets.
-- * Identificador libre en el ticket ("chicho", no único): obligatorio en todo
--   lo que carga un pasador y en cualquier jugada a nombre de un pasador (no
--   tiene nombre de jugador). Las repeticiones copian el del ticket original.
-- * ASSISTANT ("Super"): carga a nombre de pasadores y jugadores de toda la
--   organización, con el corte del admin y la fecha de hoy; edita y borra
--   jugadas de toda la organización hasta ese corte. No repite sin cargo.

-- ============================================================
-- 1. Número de grupo
-- ============================================================

ALTER TABLE polla_groups ADD COLUMN IF NOT EXISTS number INTEGER;

COMMENT ON COLUMN polla_groups.number IS
  'Número del grupo dentro de la organización (1 a N). Encabeza el número de ticket.';

-- Los activos, de 1 a N por orden de alta; los borrados aparte (no entran en
-- el índice único).
WITH numbered AS (
  SELECT
    polla_group_id,
    ROW_NUMBER() OVER (
      PARTITION BY polla_organization_id, (deleted_at IS NULL)
      ORDER BY created_at, polla_group_id
    ) AS new_number
  FROM polla_groups
)
UPDATE polla_groups g
SET number = n.new_number
FROM numbered n
WHERE g.polla_group_id = n.polla_group_id
  AND g.number IS NULL;

ALTER TABLE polla_groups ALTER COLUMN number SET NOT NULL;

ALTER TABLE polla_groups DROP CONSTRAINT IF EXISTS polla_groups_number_positive;
ALTER TABLE polla_groups
  ADD CONSTRAINT polla_groups_number_positive CHECK (number > 0);

CREATE UNIQUE INDEX IF NOT EXISTS unique_polla_group_number_active
  ON polla_groups (polla_organization_id, number)
  WHERE deleted_at IS NULL;

-- El alta toma el siguiente número libre de la organización (también la de
-- polla_create_group_with_admin, que no lo manda).
DROP TRIGGER IF EXISTS trg_assign_polla_group_number ON polla_groups;
DROP FUNCTION IF EXISTS assign_polla_group_number();

CREATE FUNCTION assign_polla_group_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL THEN
    -- Un alta por vez en la organización: dos grupos nuevos no toman el mismo.
    PERFORM 1
    FROM polla_organizations
    WHERE polla_organization_id = NEW.polla_organization_id
    FOR UPDATE;

    SELECT COALESCE(MAX(number), 0) + 1 INTO NEW.number
    FROM polla_groups
    WHERE polla_organization_id = NEW.polla_organization_id
      AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_polla_group_number
  BEFORE INSERT ON polla_groups
  FOR EACH ROW EXECUTE FUNCTION assign_polla_group_number();

-- ============================================================
-- 2. Números de pasador por grupo y de jugador por pasador
-- ============================================================

-- Los datos actuales son únicos por organización y tipo, así que también lo
-- son por grupo y por pasador: no hace falta backfill.
DROP INDEX IF EXISTS unique_polla_user_number_active;

CREATE UNIQUE INDEX IF NOT EXISTS unique_polla_cashier_number_active
  ON polla_users (
    polla_organization_id,
    COALESCE(polla_group_id, '00000000-0000-0000-0000-000000000000'::UUID),
    number
  )
  WHERE user_type = 'CASHIER' AND deleted_at IS NULL AND number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_polla_player_number_active
  ON polla_users (parent_polla_user_id, number)
  WHERE user_type = 'PLAYER' AND deleted_at IS NULL AND number IS NOT NULL;

-- El buscador sigue pidiendo por organización y número exacto.
CREATE INDEX IF NOT EXISTS idx_polla_users_org_number
  ON polla_users (polla_organization_id, number)
  WHERE deleted_at IS NULL AND number IS NOT NULL;

-- ============================================================
-- 3. Usuarios de calle
-- ============================================================

ALTER TABLE polla_users ADD COLUMN IF NOT EXISTS is_street BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN polla_users.is_street IS
  'De calle: sin usuario ni contraseña, no entra a la aplicación (solo pasadores y jugadores).';

ALTER TABLE polla_users DROP CONSTRAINT IF EXISTS polla_users_street_check;
ALTER TABLE polla_users
  ADD CONSTRAINT polla_users_street_check CHECK (
    NOT is_street
    OR (user_type IN ('CASHIER', 'PLAYER') AND username IS NULL AND password_hash IS NULL)
  );

-- ============================================================
-- 4. ASSISTANT en las reglas de usuarios: sin comisión, sin pasador, sin grupo
-- ============================================================

ALTER TABLE polla_users DROP CONSTRAINT IF EXISTS polla_users_role_fields_check;
ALTER TABLE polla_users
  ADD CONSTRAINT polla_users_role_fields_check CHECK (
    (user_type = 'CASHIER'
      AND fee IS NOT NULL AND fee_plus IS NOT NULL
      AND parent_polla_user_id IS NULL)
    OR
    (user_type = 'PLAYER'
      AND fee IS NULL AND fee_plus IS NULL
      AND parent_polla_user_id IS NOT NULL)
    OR
    (user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN', 'ASSISTANT', 'ADMIN')
      AND fee IS NULL AND fee_plus IS NULL
      AND parent_polla_user_id IS NULL)
  );

-- Igual que en 20261021233442; cambia la lista de roles de la organización.
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
  IF NEW.user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN', 'ASSISTANT') THEN
    NEW.polla_group_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_polla_user_group
  BEFORE INSERT OR UPDATE OF parent_polla_user_id, polla_group_id, user_type ON polla_users
  FOR EACH ROW EXECUTE FUNCTION sync_polla_user_group();

-- ============================================================
-- 5. Identificador del ticket
-- ============================================================

ALTER TABLE polla_bets ADD COLUMN IF NOT EXISTS identifier TEXT;

COMMENT ON COLUMN polla_bets.identifier IS
  'Identificador libre del ticket ("chicho", no único): de quién es la jugada que carga un pasador.';

ALTER TABLE polla_bets DROP CONSTRAINT IF EXISTS polla_bets_identifier_length;
ALTER TABLE polla_bets
  ADD CONSTRAINT polla_bets_identifier_length CHECK (
    identifier IS NULL OR char_length(identifier) BETWEEN 1 AND 60
  );

-- ============================================================
-- 6. Corte de carga: ASSISTANT con la regla del admin
-- ============================================================

DROP FUNCTION IF EXISTS polla_load_cutoff(polla_editions, polla_user_type_enum);

-- Momento (hora de Argentina) hasta el que el rol carga en la edición. NULL:
-- sin corte, hasta el último día de juego (superadmin y superiores).
CREATE FUNCTION polla_load_cutoff(
  p_edition polla_editions,
  p_role polla_user_type_enum
)
RETURNS TIMESTAMP
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_latest_schedule TIME;
  v_draw_time TIME;
BEGIN
  IF p_role IN ('OWNER', 'CAPITALIST', 'SUPERADMIN') THEN
    RETURN NULL;
  END IF;

  IF p_role NOT IN ('ADMIN', 'ASSISTANT') THEN
    RETURN p_edition.load_limit_date + p_edition.load_limit_time;
  END IF;

  SELECT MAX(time) INTO v_latest_schedule
  FROM polla_schedules
  WHERE polla_organization_id = p_edition.polla_organization_id
    AND active
    AND deleted_at IS NULL;

  SELECT time INTO v_draw_time
  FROM polla_schedules
  WHERE polla_schedule_id = p_edition.polla_schedule_id;

  RETURN LEAST(
    p_edition.load_limit_date
      + GREATEST(p_edition.load_limit_time, COALESCE(v_latest_schedule, p_edition.load_limit_time)),
    p_edition.start_date + COALESCE(v_draw_time, '23:59:59'::TIME)
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_load_cutoff(polla_editions, polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_load_cutoff(polla_editions, polla_user_type_enum) TO service_role;

-- ============================================================
-- 7. Alta de una jugada: identificador y número de ticket nuevo
-- ============================================================

DROP FUNCTION IF EXISTS polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT);

CREATE FUNCTION polla_create_bet(
  p_edition_id UUID,
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_numbers TEXT[],
  p_date DATE DEFAULT NULL,
  -- Sin uso: el corte sale del rol del actor. Queda para la API del deploy.
  p_force BOOLEAN DEFAULT FALSE,
  p_free BOOLEAN DEFAULT FALSE,
  p_repeated_from UUID DEFAULT NULL,
  p_identifier TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor polla_users;
  v_is_super BOOLEAN;
  v_date DATE;
  v_edition polla_editions;
  v_target polla_users;
  v_cashier polla_users;
  v_amount NUMERIC(12,2);
  v_identifier TEXT;
  v_group_number INTEGER;
  v_player_number INTEGER;
  v_ticket_number TEXT;
  v_bet polla_bets;
  v_attempt INTEGER := 0;
BEGIN
  IF array_length(p_numbers, 1) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_MUST_BE_TEN';
  END IF;

  SELECT * INTO v_actor
  FROM polla_users
  WHERE polla_user_id = p_actor_user_id
    AND deleted_at IS NULL
    AND disabled = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  v_is_super := v_actor.user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN');
  -- Solo superadmin+ elige el día de carga.
  v_date := CASE WHEN v_is_super THEN COALESCE(p_date, polla_today()) ELSE polla_today() END;

  IF p_free AND v_actor.user_type NOT IN ('OWNER', 'CAPITALIST', 'SUPERADMIN', 'ADMIN') THEN
    RAISE EXCEPTION 'POLLA_FREE_BET_FORBIDDEN';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF v_edition.polla_organization_id <> v_actor.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_USER_OTHER_ORGANIZATION';
  END IF;

  IF v_edition.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_ACTIVE';
  END IF;

  IF NOT polla_can_load(v_edition, v_actor.user_type) THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  SELECT * INTO v_target
  FROM polla_users
  WHERE polla_user_id = p_target_user_id
    AND deleted_at IS NULL
    AND disabled = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  IF v_target.polla_organization_id <> v_edition.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_USER_OTHER_ORGANIZATION';
  END IF;

  IF v_target.user_type NOT IN ('PLAYER', 'CASHIER') THEN
    RAISE EXCEPTION 'POLLA_USER_CANNOT_BET';
  END IF;

  -- A nombre de quién carga cada rol: el admin en su grupo, el pasador a él o
  -- a sus jugadores, el jugador a él. ASSISTANT y superadmin+, a cualquiera de
  -- la organización.
  IF v_actor.user_type = 'ADMIN' THEN
    IF v_actor.polla_group_id IS NULL
       OR v_target.polla_group_id IS DISTINCT FROM v_actor.polla_group_id THEN
      RAISE EXCEPTION 'POLLA_USER_OTHER_GROUP';
    END IF;
  ELSIF v_actor.user_type = 'CASHIER' THEN
    IF v_target.polla_user_id <> v_actor.polla_user_id
       AND v_target.parent_polla_user_id IS DISTINCT FROM v_actor.polla_user_id THEN
      RAISE EXCEPTION 'POLLA_BET_TARGET_FORBIDDEN';
    END IF;
  ELSIF v_actor.user_type = 'PLAYER' THEN
    IF v_target.polla_user_id <> v_actor.polla_user_id THEN
      RAISE EXCEPTION 'POLLA_BET_TARGET_FORBIDDEN';
    END IF;
  END IF;

  -- Todo ticket tiene nombre de jugador o identificador; el pasador lo pone
  -- siempre. Una repetición copia el del original (los tickets viejos no
  -- tienen).
  v_identifier := NULLIF(btrim(p_identifier), '');

  IF v_identifier IS NULL
     AND p_repeated_from IS NULL
     AND (v_actor.user_type = 'CASHIER' OR v_target.user_type = 'CASHIER') THEN
    RAISE EXCEPTION 'POLLA_BET_IDENTIFIER_REQUIRED';
  END IF;

  IF v_target.user_type = 'PLAYER' THEN
    SELECT * INTO v_cashier
    FROM polla_users
    WHERE polla_user_id = v_target.parent_polla_user_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POLLA_PARENT_NOT_FOUND';
    END IF;

    v_player_number := v_target.number;
  ELSE
    v_cashier := v_target;
    v_player_number := 0;
  END IF;

  -- Sin grupo = 0.
  SELECT number INTO v_group_number
  FROM polla_groups
  WHERE polla_group_id = v_cashier.polla_group_id;

  v_amount := CASE WHEN p_free THEN 0 ELSE v_edition.ticket_price END;

  LOOP
    v_attempt := v_attempt + 1;
    v_ticket_number := COALESCE(v_group_number, 0)::TEXT
                       || '-'
                       || to_char(
                            clock_timestamp() AT TIME ZONE 'America/Argentina/Buenos_Aires',
                            'YYYYMMDDHH24MISSMS'
                          )
                       || '-'
                       || COALESCE(v_cashier.number, 0)::TEXT
                       || '-'
                       || COALESCE(v_player_number, 0)::TEXT;

    BEGIN
      INSERT INTO polla_bets (
        ticket_number,
        polla_edition_id,
        polla_user_id,
        cashier_polla_user_id,
        polla_organization_id,
        polla_group_id,
        user_name,
        cashier_name,
        cashier_number,
        load_date,
        amount,
        numbers,
        created_by,
        is_free,
        repeated_from_bet_id,
        identifier
      ) VALUES (
        v_ticket_number,
        v_edition.polla_edition_id,
        v_target.polla_user_id,
        v_cashier.polla_user_id,
        v_edition.polla_organization_id,
        v_cashier.polla_group_id,
        v_target.name,
        v_cashier.name,
        v_cashier.number,
        v_date,
        v_amount,
        p_numbers,
        p_actor_user_id,
        COALESCE(p_free, FALSE),
        p_repeated_from,
        v_identifier
      )
      RETURNING * INTO v_bet;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 5 THEN
        RAISE EXCEPTION 'POLLA_TICKET_NUMBER_COLLISION';
      END IF;
      PERFORM pg_sleep(0.005);
    END;
  END LOOP;

  UPDATE polla_editions
  SET bets_count = bets_count + 1,
      collected_amount = collected_amount + v_amount,
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id;

  PERFORM polla_refresh_current_account_row(
    v_bet.cashier_polla_user_id,
    v_bet.load_date,
    v_bet.polla_organization_id
  );

  RETURN jsonb_build_object('success', true, 'bet', to_jsonb(v_bet));
END;
$$;

REVOKE ALL ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT) TO service_role;

-- ============================================================
-- 8. ¿Puede el actor modificar esta jugada ahora? ASSISTANT: toda la
--    organización, hasta su corte
-- ============================================================

DROP FUNCTION IF EXISTS polla_assert_bet_writable(polla_bets, polla_users, polla_editions, BOOLEAN);

CREATE FUNCTION polla_assert_bet_writable(
  p_bet polla_bets,
  p_actor polla_users,
  p_edition polla_editions,
  p_editing BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMP;
BEGIN
  IF p_bet.polla_organization_id <> p_actor.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_USER_OTHER_ORGANIZATION';
  END IF;

  -- Superadmin+: siempre.
  IF p_actor.user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN') THEN
    RETURN;
  END IF;

  IF p_actor.user_type = 'ADMIN' THEN
    IF p_actor.polla_group_id IS NULL
       OR p_bet.polla_group_id IS DISTINCT FROM p_actor.polla_group_id THEN
      RAISE EXCEPTION 'POLLA_USER_OTHER_GROUP';
    END IF;
  ELSIF p_actor.user_type = 'ASSISTANT' THEN
    -- Toda la organización (ya controlada arriba).
    NULL;
  ELSIF p_actor.user_type = 'CASHIER' AND NOT p_editing THEN
    IF p_bet.cashier_polla_user_id <> p_actor.polla_user_id THEN
      RAISE EXCEPTION 'POLLA_BET_TARGET_FORBIDDEN';
    END IF;
  ELSE
    -- El pasador no edita; el jugador no modifica nada.
    RAISE EXCEPTION 'POLLA_BET_WRITE_FORBIDDEN';
  END IF;

  v_cutoff := polla_load_cutoff(p_edition, p_actor.user_type);
  IF v_cutoff IS NOT NULL AND polla_now() > v_cutoff THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION polla_assert_bet_writable(polla_bets, polla_users, polla_editions, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_assert_bet_writable(polla_bets, polla_users, polla_editions, BOOLEAN) TO service_role;

-- ============================================================
-- 9. Repetir tickets: con su identificador; ASSISTANT en toda la organización
-- ============================================================

DROP FUNCTION IF EXISTS polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN);

CREATE FUNCTION polla_repeat_bets(
  p_actor_id UUID,
  p_edition_id UUID,
  p_bet_ids UUID[],
  p_free BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor polla_users;
  v_edition polla_editions;
  v_source polla_bets;
  v_source_status polla_edition_status_enum;
  v_source_id UUID;
  v_result JSONB;
  v_created JSONB := '[]'::JSONB;
  v_skipped JSONB := '[]'::JSONB;
  v_reason TEXT;
BEGIN
  SELECT * INTO v_actor
  FROM polla_users
  WHERE polla_user_id = p_actor_id
    AND deleted_at IS NULL
    AND disabled = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  IF p_free AND v_actor.user_type NOT IN ('OWNER', 'CAPITALIST', 'SUPERADMIN', 'ADMIN') THEN
    RAISE EXCEPTION 'POLLA_FREE_BET_FORBIDDEN';
  END IF;

  -- Lo que vale para todo el lote se controla una vez.
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF v_edition.polla_organization_id <> v_actor.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_USER_OTHER_ORGANIZATION';
  END IF;

  IF NOT polla_can_load(v_edition, v_actor.user_type) THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  FOR v_source_id IN SELECT DISTINCT unnest(p_bet_ids)
  LOOP
    v_reason := NULL;

    SELECT * INTO v_source
    FROM polla_bets
    WHERE polla_bet_id = v_source_id
      AND deleted_at IS NULL;

    -- ASSISTANT y superadmin+: cualquiera de la organización.
    IF NOT FOUND OR v_source.polla_organization_id <> v_actor.polla_organization_id THEN
      v_reason := 'POLLA_BET_NOT_FOUND';
    ELSIF v_actor.user_type = 'ADMIN'
      AND (v_actor.polla_group_id IS NULL
           OR v_source.polla_group_id IS DISTINCT FROM v_actor.polla_group_id) THEN
      v_reason := 'POLLA_BET_OUT_OF_SCOPE';
    ELSIF v_actor.user_type = 'CASHIER'
      AND v_source.cashier_polla_user_id <> v_actor.polla_user_id THEN
      v_reason := 'POLLA_BET_OUT_OF_SCOPE';
    ELSIF v_actor.user_type = 'PLAYER'
      AND v_source.polla_user_id <> v_actor.polla_user_id THEN
      v_reason := 'POLLA_BET_OUT_OF_SCOPE';
    END IF;

    IF v_reason IS NULL AND p_free THEN
      SELECT status INTO v_source_status
      FROM polla_editions
      WHERE polla_edition_id = v_source.polla_edition_id;

      IF v_source_status IS DISTINCT FROM 'FINISHED' THEN
        v_reason := 'POLLA_SOURCE_EDITION_NOT_FINISHED';
      END IF;
    END IF;

    IF v_reason IS NULL THEN
      BEGIN
        v_result := polla_create_bet(
          p_edition_id,
          p_actor_id,
          v_source.polla_user_id,
          v_source.numbers,
          NULL,
          FALSE,
          p_free,
          v_source.polla_bet_id,
          v_source.identifier
        );
        v_created := v_created || jsonb_build_array(v_result->'bet');
      EXCEPTION WHEN OTHERS THEN
        v_reason := SQLERRM;
      END;
    END IF;

    IF v_reason IS NOT NULL THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'polla_bet_id', v_source_id,
        'ticket_number', v_source.ticket_number,
        'user_name', v_source.user_name,
        'reason', v_reason
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('created', v_created, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN) TO service_role;
