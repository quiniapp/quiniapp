-- R04: cerrar el ticket con Efectivo (pagado) o Debe (fiado).
--
-- 1. Cada jugada guarda su estado de pago (`payment_status`: PAID u OWED) y,
--    si está pagada, el medio (`payment_method`), cuándo y quién la cobró.
--    Por ahora el único medio es CASH; QR o transferencia se suman con
--    `ALTER TYPE polla_payment_method_enum ADD VALUE ...`.
-- 2. Las jugadas que ya existen quedan pagadas en efectivo, cobradas al
--    cargarse y por quien las cargó.
-- 3. `polla_create_bet` y `polla_repeat_bets` reciben `p_payment_status`:
--    - el jugador carga siempre en Debe (lo cobra su pasador), sin elegir;
--    - lo repetido sin cargo queda pagado (no hay nada que cobrar);
--    - el resto elige, y si no manda nada queda en Efectivo (como hasta ahora).
--
-- Una jugada en Debe entra al sorteo y cuenta en el pase como cualquier otra:
-- la cuenta corriente no cambia.

CREATE TYPE polla_payment_status_enum AS ENUM ('PAID', 'OWED');
CREATE TYPE polla_payment_method_enum AS ENUM ('CASH');

ALTER TABLE polla_bets
  ADD COLUMN payment_status polla_payment_status_enum NOT NULL DEFAULT 'PAID',
  ADD COLUMN payment_method polla_payment_method_enum,
  ADD COLUMN paid_at TIMESTAMPTZ,
  ADD COLUMN paid_by UUID REFERENCES polla_users(polla_user_id);

COMMENT ON COLUMN polla_bets.payment_status IS
  'PAID (pagada) u OWED (Debe: fiada). Las dos entran al sorteo y al pase.';
COMMENT ON COLUMN polla_bets.payment_method IS
  'Medio con que se pagó (CASH). NULL en Debe y en las repetidas sin cargo.';
COMMENT ON COLUMN polla_bets.paid_at IS 'Cuándo se cobró (al cargarla, o al marcarla como pagada).';
COMMENT ON COLUMN polla_bets.paid_by IS 'Quién la cobró.';

-- Las existentes: pagadas en efectivo al cargarse (las sin cargo, sin medio).
UPDATE polla_bets
SET payment_method = CASE WHEN is_free THEN NULL ELSE 'CASH'::polla_payment_method_enum END,
    paid_at = created_at,
    paid_by = created_by;

-- En Debe no hay cobro. Una pagada puede no tener `paid_at` (datos de prueba
-- o inserts directos): no se exige.
ALTER TABLE polla_bets
  ADD CONSTRAINT polla_bets_payment_check CHECK (
    payment_status = 'PAID'
    OR (payment_method IS NULL AND paid_at IS NULL AND paid_by IS NULL)
  );

-- "Impagos" de una edición: el filtro y el borrado del pasador.
CREATE INDEX idx_polla_bets_edition_owed
  ON polla_bets (polla_edition_id, cashier_polla_user_id)
  WHERE payment_status = 'OWED' AND deleted_at IS NULL;

-- ------------------------------------------------------------ alta

DROP FUNCTION IF EXISTS polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT);

CREATE OR REPLACE FUNCTION polla_create_bet(
  p_edition_id UUID,
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_numbers TEXT[],
  p_date DATE DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE,
  p_free BOOLEAN DEFAULT FALSE,
  p_repeated_from UUID DEFAULT NULL,
  p_identifier TEXT DEFAULT NULL,
  p_payment_status polla_payment_status_enum DEFAULT NULL
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
  v_payment polla_payment_status_enum;
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

  -- Todo ticket tiene nombre de jugador o identificador: a nombre de un
  -- jugador el identificador es opcional; a nombre de un pasador (sin
  -- jugador), obligatorio. Una repetición copia el del original (los tickets
  -- viejos no tienen).
  v_identifier := NULLIF(btrim(p_identifier), '');

  IF v_identifier IS NULL
     AND p_repeated_from IS NULL
     AND v_target.user_type = 'CASHIER' THEN
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

  -- R04: lo repetido sin cargo no tiene nada que cobrar; el jugador carga
  -- siempre en Debe (lo cobra su pasador); el resto elige, Efectivo si no dice.
  v_payment := CASE
    WHEN p_free THEN 'PAID'
    WHEN v_actor.user_type = 'PLAYER' THEN 'OWED'
    ELSE COALESCE(p_payment_status, 'PAID')
  END;

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
        identifier,
        payment_status,
        payment_method,
        paid_at,
        paid_by
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
        v_identifier,
        v_payment,
        CASE WHEN v_payment = 'PAID' AND NOT COALESCE(p_free, FALSE) THEN 'CASH' END::polla_payment_method_enum,
        CASE WHEN v_payment = 'PAID' THEN NOW() END,
        CASE WHEN v_payment = 'PAID' THEN p_actor_user_id END
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

-- --------------------------------------------------------- repetir

DROP FUNCTION IF EXISTS polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN);

CREATE OR REPLACE FUNCTION polla_repeat_bets(
  p_actor_id UUID,
  p_edition_id UUID,
  p_bet_ids UUID[],
  p_free BOOLEAN DEFAULT FALSE,
  p_payment_status polla_payment_status_enum DEFAULT NULL
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
        -- El pago se elige para todo el lote (el jugador, siempre Debe; sin
        -- cargo, pagado: lo resuelve polla_create_bet).
        v_result := polla_create_bet(
          p_edition_id,
          p_actor_id,
          v_source.polla_user_id,
          v_source.numbers,
          NULL,
          FALSE,
          p_free,
          v_source.polla_bet_id,
          v_source.identifier,
          p_payment_status
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

REVOKE ALL ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT, polla_payment_status_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT, polla_payment_status_enum) TO service_role;
REVOKE ALL ON FUNCTION polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN, polla_payment_status_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN, polla_payment_status_enum) TO service_role;

-- ROLLBACK:
-- Se pierde el estado de pago: antes de volver atrás conviene exportar qué
-- tickets están en Debe (payment_status = 'OWED').
--
-- DROP FUNCTION IF EXISTS polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN, polla_payment_status_enum);
-- DROP FUNCTION IF EXISTS polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT, polla_payment_status_enum);
-- Volver a crear las anteriores:
--   polla_create_bet(UUID, UUID, UUID, TEXT[], DATE, BOOLEAN, BOOLEAN, UUID, TEXT) de
--     20261029064157_polla_identifier_rule_edition_sales.sql
--   polla_repeat_bets(UUID, UUID, UUID[], BOOLEAN) de
--     20261027221619_polla_group_numbers_street_users.sql
-- DROP INDEX IF EXISTS idx_polla_bets_edition_owed;
-- ALTER TABLE polla_bets DROP CONSTRAINT IF EXISTS polla_bets_payment_check;
-- ALTER TABLE polla_bets
--   DROP COLUMN IF EXISTS paid_by,
--   DROP COLUMN IF EXISTS paid_at,
--   DROP COLUMN IF EXISTS payment_method,
--   DROP COLUMN IF EXISTS payment_status;
-- DROP TYPE IF EXISTS polla_payment_method_enum;
-- DROP TYPE IF EXISTS polla_payment_status_enum;
