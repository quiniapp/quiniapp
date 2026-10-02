-- Polla (sistema independiente): RPCs de jugadas, créditos, aciertos y
-- liquidación. Los errores de negocio se lanzan como 'POLLA_*' y el router los
-- mapea a AppError.

-- ============================================================
-- 1. Créditos de un jugador
-- ============================================================

CREATE OR REPLACE FUNCTION polla_adjust_credits(
  p_player_id UUID,
  p_amount NUMERIC,
  p_type polla_credit_movement_type_enum,
  p_reason TEXT,
  p_actor_id UUID,
  p_bet_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_player polla_users;
  v_new_balance NUMERIC(12,2);
  v_movement_id UUID;
BEGIN
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'POLLA_CREDIT_AMOUNT_ZERO';
  END IF;

  IF p_type = 'LOAD' AND p_amount < 0 THEN
    RAISE EXCEPTION 'POLLA_CREDIT_SIGN_MISMATCH';
  END IF;

  IF p_type = 'WITHDRAW' AND p_amount > 0 THEN
    RAISE EXCEPTION 'POLLA_CREDIT_SIGN_MISMATCH';
  END IF;

  SELECT * INTO v_player
  FROM polla_users
  WHERE polla_user_id = p_player_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_FOUND';
  END IF;

  IF v_player.user_type <> 'PLAYER' THEN
    RAISE EXCEPTION 'POLLA_USER_NOT_PLAYER';
  END IF;

  v_new_balance := v_player.credit_balance + p_amount;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'POLLA_INSUFFICIENT_CREDITS';
  END IF;

  UPDATE polla_users
  SET credit_balance = v_new_balance,
      edited_at = NOW()
  WHERE polla_user_id = p_player_id;

  INSERT INTO polla_credit_movements (
    polla_user_id,
    cashier_polla_user_id,
    polla_organization_id,
    created_by_polla_user_id,
    type,
    amount,
    balance_after,
    polla_bet_id,
    reason
  ) VALUES (
    p_player_id,
    v_player.parent_polla_user_id,
    v_player.polla_organization_id,
    p_actor_id,
    p_type,
    p_amount,
    v_new_balance,
    p_bet_id,
    p_reason
  )
  RETURNING polla_credit_movement_id INTO v_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'polla_credit_movement_id', v_movement_id,
    'polla_user_id', p_player_id,
    'balance', v_new_balance
  );
END;
$$;

-- ============================================================
-- 2. Alta de una jugada
-- ============================================================

CREATE OR REPLACE FUNCTION polla_create_bet(
  p_edition_id UUID,
  p_actor_user_id UUID,
  p_target_user_id UUID,
  p_numbers TEXT[],
  p_date DATE DEFAULT CURRENT_DATE,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
  v_target polla_users;
  v_cashier polla_users;
  v_ticket_number TEXT;
  v_bet polla_bets;
  v_attempt INTEGER := 0;
BEGIN
  IF array_length(p_numbers, 1) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_MUST_BE_TEN';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF v_edition.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_ACTIVE';
  END IF;

  IF p_date > v_edition.load_limit_date AND NOT p_force THEN
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

  -- Resolver el pasador al que se le imputa la jugada
  IF v_target.user_type = 'PLAYER' THEN
    SELECT * INTO v_cashier
    FROM polla_users
    WHERE polla_user_id = v_target.parent_polla_user_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POLLA_PARENT_NOT_FOUND';
    END IF;
  ELSE
    v_cashier := v_target;
  END IF;

  -- Débito de créditos al jugador (el pasador juega contra su cuenta corriente)
  IF v_target.user_type = 'PLAYER' THEN
    PERFORM polla_adjust_credits(
      v_target.polla_user_id,
      -v_edition.ticket_price,
      'BET',
      NULL,
      p_actor_user_id,
      NULL
    );
  END IF;

  -- ticket_number con el mismo formato que QuiniApp; reintenta ante colisión
  LOOP
    v_attempt := v_attempt + 1;
    v_ticket_number := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
                       || '-'
                       || COALESCE(v_cashier.number, (floor(random() * 1000))::INTEGER);

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
        numbers
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
        p_date,
        v_edition.ticket_price,
        p_numbers
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

  -- El movimiento de crédito queda enlazado a la jugada recién creada
  IF v_target.user_type = 'PLAYER' THEN
    UPDATE polla_credit_movements
    SET polla_bet_id = v_bet.polla_bet_id
    WHERE polla_credit_movement_id = (
      SELECT polla_credit_movement_id
      FROM polla_credit_movements
      WHERE polla_user_id = v_target.polla_user_id
        AND type = 'BET'
        AND polla_bet_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    );
  END IF;

  UPDATE polla_editions
  SET bets_count = bets_count + 1,
      collected_amount = collected_amount + v_edition.ticket_price,
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id;

  RETURN jsonb_build_object('success', true, 'bet', to_jsonb(v_bet));
END;
$$;

-- ============================================================
-- 3. Edición de los números de una jugada
-- ============================================================

CREATE OR REPLACE FUNCTION polla_update_bet_numbers(
  p_bet_id UUID,
  p_numbers TEXT[],
  p_actor_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bet polla_bets;
  v_edition polla_editions;
BEGIN
  IF array_length(p_numbers, 1) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_MUST_BE_TEN';
  END IF;

  SELECT * INTO v_bet
  FROM polla_bets
  WHERE polla_bet_id = p_bet_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_BET_NOT_FOUND';
  END IF;

  IF v_bet.winner THEN
    RAISE EXCEPTION 'POLLA_BET_ALREADY_WINNER';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = v_bet.polla_edition_id;

  IF CURRENT_DATE > v_edition.load_limit_date AND NOT p_force THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  UPDATE polla_bets
  SET numbers = p_numbers,
      hit_numbers = '{}',
      hits = 0
  WHERE polla_bet_id = p_bet_id
  RETURNING * INTO v_bet;

  RETURN jsonb_build_object('success', true, 'bet', to_jsonb(v_bet));
END;
$$;

-- ============================================================
-- 4. Baja de una jugada (soft delete + devolución de créditos)
-- ============================================================

CREATE OR REPLACE FUNCTION polla_delete_bet(
  p_bet_id UUID,
  p_actor_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bet polla_bets;
  v_edition polla_editions;
  v_owner_type polla_user_type_enum;
BEGIN
  SELECT * INTO v_bet
  FROM polla_bets
  WHERE polla_bet_id = p_bet_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_BET_NOT_FOUND';
  END IF;

  IF v_bet.winner THEN
    RAISE EXCEPTION 'POLLA_BET_ALREADY_WINNER';
  END IF;

  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = v_bet.polla_edition_id;

  IF CURRENT_DATE > v_edition.load_limit_date AND NOT p_force THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  UPDATE polla_bets
  SET deleted_at = NOW(),
      deleted_by = p_actor_id
  WHERE polla_bet_id = p_bet_id;

  UPDATE polla_editions
  SET bets_count = GREATEST(bets_count - 1, 0),
      collected_amount = GREATEST(collected_amount - v_bet.amount, 0),
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id;

  SELECT user_type INTO v_owner_type
  FROM polla_users
  WHERE polla_user_id = v_bet.polla_user_id;

  IF v_owner_type = 'PLAYER' THEN
    PERFORM polla_adjust_credits(
      v_bet.polla_user_id,
      v_bet.amount,
      'BET_REFUND',
      'Devolución por baja de jugada ' || v_bet.ticket_number,
      p_actor_id,
      v_bet.polla_bet_id
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'polla_bet_id', p_bet_id);
END;
$$;

-- ============================================================
-- 5. Procesamiento diario de aciertos
-- ============================================================

CREATE OR REPLACE FUNCTION polla_process_edition_hits(
  p_organization_id UUID,
  p_lottery_id UUID,
  p_schedule_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
  v_results TEXT[];
  v_drawn TEXT[];
  v_updated INTEGER := 0;
  v_winner_count INTEGER := 0;
  v_prize NUMERIC(12,2) := 0;
BEGIN
  -- Solo ediciones ACTIVE que cubran la fecha: una vez que hubo ganador la
  -- edición queda FINISHED y los días siguientes no recalculan nada.
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_organization_id = p_organization_id
    AND polla_lottery_id = p_lottery_id
    AND polla_schedule_id = p_schedule_id
    AND status = 'ACTIVE'
    AND p_date BETWEEN start_date AND end_date
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'NO_ACTIVE_EDITION');
  END IF;

  SELECT results INTO v_results
  FROM polla_results
  WHERE polla_organization_id = p_organization_id
    AND polla_lottery_id = p_lottery_id
    AND polla_schedule_id = p_schedule_id
    AND date = p_date
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'NO_RESULTS');
  END IF;

  -- Últimas 2 cifras de cada uno de los 20 números
  v_drawn := ARRAY(SELECT DISTINCT RIGHT(r, 2) FROM unnest(v_results) r);

  -- Acumulación set-based: nunca se pierde un acierto previo
  WITH pending AS (
    SELECT polla_bet_id, numbers, hit_numbers
    FROM polla_bets
    WHERE polla_edition_id = v_edition.polla_edition_id
      AND winner = FALSE
      AND deleted_at IS NULL
  ),
  computed AS (
    SELECT
      p.polla_bet_id,
      ARRAY(
        SELECT DISTINCT n
        FROM unnest(
          p.hit_numbers || ARRAY(SELECT x FROM unnest(p.numbers) x WHERE x = ANY(v_drawn))
        ) n
        ORDER BY n
      ) AS new_hits
    FROM pending p
  ),
  applied AS (
    UPDATE polla_bets b
    SET hit_numbers = c.new_hits,
        hits = COALESCE(array_length(c.new_hits, 1), 0)
    FROM computed c
    WHERE b.polla_bet_id = c.polla_bet_id
      AND b.hit_numbers IS DISTINCT FROM c.new_hits
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_updated FROM applied;

  SELECT COUNT(*) INTO v_winner_count
  FROM polla_bets
  WHERE polla_edition_id = v_edition.polla_edition_id
    AND winner = FALSE
    AND deleted_at IS NULL
    AND hits >= 10;

  IF v_winner_count > 0 THEN
    v_prize := ROUND(v_edition.pool_amount / v_winner_count, 2);

    UPDATE polla_bets
    SET winner = TRUE,
        prize = v_prize,
        hit_date = p_date
    WHERE polla_edition_id = v_edition.polla_edition_id
      AND winner = FALSE
      AND deleted_at IS NULL
      AND hits >= 10;

    UPDATE polla_editions
    SET status = 'FINISHED',
        winner_date = p_date,
        edited_at = NOW()
    WHERE polla_edition_id = v_edition.polla_edition_id;

  ELSIF p_date >= v_edition.end_date THEN
    UPDATE polla_editions
    SET status = 'FINISHED',
        winner_date = NULL,
        edited_at = NOW()
    WHERE polla_edition_id = v_edition.polla_edition_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'polla_edition_id', v_edition.polla_edition_id,
    'date', p_date,
    'bets_updated', v_updated,
    'winners', v_winner_count,
    'prize_per_winner', v_prize
  );
END;
$$;

-- ============================================================
-- 6. Cuenta corriente: cálculo masivo del día
--    Calco de calculate_current_account (20260516140000) con los pases y
--    premios tomados directo de polla_bets: no hay tabla de tickets.
-- ============================================================

CREATE OR REPLACE FUNCTION polla_calculate_current_account(
  p_date_text TEXT,
  p_calculate_leave BOOLEAN DEFAULT FALSE,
  p_liquidated BOOLEAN DEFAULT FALSE,
  p_organization_id UUID DEFAULT NULL,
  p_leave_in_subtotal BOOLEAN DEFAULT FALSE
)
RETURNS JSONB[]
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_date DATE := to_date(p_date_text, 'DD-MM-YYYY');
  result_array JSONB[];
BEGIN
  IF p_organization_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('polla:' || p_organization_id::text || ':' || p_date_text));
  END IF;

  WITH
  daily_activity AS (
    SELECT
      b.cashier_polla_user_id AS polla_user_id,
      COALESCE(SUM(b.amount) FILTER (WHERE b.load_date = v_date), 0) AS pass_raw,
      COALESCE(SUM(b.prize) FILTER (WHERE b.winner AND b.hit_date = v_date), 0) AS successes
    FROM polla_bets b
    WHERE b.deleted_at IS NULL
      AND (b.load_date = v_date OR (b.winner AND b.hit_date = v_date))
      AND (p_organization_id IS NULL OR b.polla_organization_id = p_organization_id)
    GROUP BY b.cashier_polla_user_id
  ),
  previous_state AS (
    SELECT DISTINCT ON (ca.polla_user_id)
      ca.polla_user_id,
      ca.total AS previous_balance,
      ca.drag AS previous_drag_raw,
      ca.leave AS previous_leave,
      ca.bills AS previous_bills,
      ca.is_liquidated AS previous_is_liquidated
    FROM polla_current_accounts ca
    WHERE ca.date < v_date
      AND (p_organization_id IS NULL OR ca.polla_organization_id = p_organization_id)
    ORDER BY ca.polla_user_id, ca.date DESC
  ),
  existing_day AS (
    SELECT
      ca.polla_user_id,
      COALESCE(ca.claims, 0) AS claims,
      COALESCE(ca.collections, 0) AS collections,
      COALESCE(ca.paid, 0) AS paid,
      COALESCE(ca.leave, 0) AS leave,
      COALESCE(ca.previous_balance, 0) AS previous_balance_today,
      COALESCE(ca.previous_drag, 0) AS previous_drag_today
    FROM polla_current_accounts ca
    WHERE ca.date = v_date
      AND (p_organization_id IS NULL OR ca.polla_organization_id = p_organization_id)
  ),
  calculated_data AS (
    SELECT
      u.polla_user_id,
      u.name AS user_name,
      u.number AS user_number,
      u.polla_organization_id,
      u.polla_group_id,
      COALESCE(da.pass_raw, 0) AS pass_raw,
      COALESCE(da.successes, 0) AS successes,
      COALESCE(ed.claims, 0) AS claims,
      COALESCE(ed.collections, 0) AS collections,
      COALESCE(ed.paid, 0) AS paid,
      COALESCE(ed.leave, 0) AS leave_manual,
      COALESCE(ed.previous_balance_today, ps.previous_balance, 0) AS prev_balance_chosen,
      COALESCE(u.fee, 0) / 100.0 AS fee_pct,
      COALESCE(u.fee_plus, 0) / 100.0 AS fee_plus_pct,
      CASE
        WHEN COALESCE(u.fee_plus, 0) <= 0 THEN 0
        ELSE COALESCE(
          ed.previous_drag_today,
          CASE
            WHEN COALESCE(ps.previous_is_liquidated, FALSE) = TRUE AND COALESCE(ps.previous_leave, 0) > 0 THEN 0
            ELSE COALESCE(ps.previous_drag_raw, 0)
          END,
          0
        )
      END AS prev_drag_eff_chosen,
      COALESCE(ps.previous_bills, 0) AS bills
    FROM polla_users u
    LEFT JOIN daily_activity da ON u.polla_user_id = da.polla_user_id
    LEFT JOIN previous_state ps ON u.polla_user_id = ps.polla_user_id
    LEFT JOIN existing_day ed ON u.polla_user_id = ed.polla_user_id
    WHERE u.user_type = 'CASHIER'
      AND u.deleted_at IS NULL
      AND (p_organization_id IS NULL OR u.polla_organization_id = p_organization_id)
  ),
  final_data AS (
    SELECT
      cd.*,
      (cd.pass_raw + GREATEST(cd.claims, 0)) AS pass,
      ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2) AS cashier_commission,
      ((cd.pass_raw + GREATEST(cd.claims, 0))
        - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
        - cd.successes
        + LEAST(cd.claims, 0)) AS revenue
    FROM calculated_data cd
  ),
  resolved AS (
    SELECT
      fd.*,
      fd.revenue AS subtotal,
      CASE WHEN fd.fee_plus_pct <= 0 THEN 0 ELSE fd.prev_drag_eff_chosen + fd.revenue END AS drag_calc,
      CASE
        WHEN fd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave THEN
          CASE
            WHEN (fd.prev_drag_eff_chosen + fd.revenue) > 0
              THEN ROUND((fd.prev_drag_eff_chosen + fd.revenue) * fd.fee_plus_pct, 2)
            ELSE 0
          END
        ELSE COALESCE(fd.leave_manual, 0)
      END AS leave_effective
    FROM final_data fd
  ),
  stored AS (
    SELECT
      r.*,
      CASE
        WHEN r.fee_plus_pct <= 0 THEN r.subtotal
        WHEN p_leave_in_subtotal AND p_calculate_leave AND r.leave_effective > 0
          THEN r.subtotal - r.leave_effective
        ELSE r.subtotal
      END AS subtotal_to_store,
      (r.prev_balance_chosen + r.revenue - r.collections + r.paid - r.leave_effective) AS total_final,
      CASE WHEN r.fee_plus_pct <= 0 THEN 0 ELSE r.prev_drag_eff_chosen END AS previous_drag_to_store
    FROM resolved r
  ),
  upserted_rows AS (
    INSERT INTO polla_current_accounts (
      polla_current_account_id,
      polla_user_id, user_name, user_number,
      polla_organization_id, polla_group_id,
      pass, successes, claims,
      subtotal, previous_balance, collections, paid,
      total, drag, leave, date,
      created_at, edited_at,
      cashier_commission, bills, revenue, previous_drag,
      is_liquidated
    )
    SELECT
      gen_random_uuid(),
      s.polla_user_id, s.user_name, s.user_number,
      s.polla_organization_id, s.polla_group_id,
      s.pass, s.successes, s.claims,
      s.subtotal_to_store, s.prev_balance_chosen, s.collections, s.paid,
      s.total_final, s.drag_calc, s.leave_effective, v_date,
      NOW(), NOW(),
      s.cashier_commission, s.bills, s.revenue, s.previous_drag_to_store,
      CASE WHEN p_liquidated THEN TRUE ELSE FALSE END
    FROM stored s
    ON CONFLICT (polla_user_id, date) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      user_number = EXCLUDED.user_number,
      polla_group_id = EXCLUDED.polla_group_id,
      pass = EXCLUDED.pass,
      successes = EXCLUDED.successes,
      claims = polla_current_accounts.claims,
      collections = polla_current_accounts.collections,
      paid = polla_current_accounts.paid,
      leave = CASE
                WHEN p_calculate_leave THEN EXCLUDED.leave
                ELSE polla_current_accounts.leave
              END,
      subtotal = EXCLUDED.subtotal,
      previous_balance = polla_current_accounts.previous_balance,
      total = EXCLUDED.total,
      drag = EXCLUDED.drag,
      edited_at = NOW(),
      cashier_commission = EXCLUDED.cashier_commission,
      bills = EXCLUDED.bills,
      revenue = EXCLUDED.revenue,
      previous_drag = polla_current_accounts.previous_drag,
      is_liquidated = CASE
                        WHEN p_liquidated THEN TRUE
                        ELSE polla_current_accounts.is_liquidated
                      END
    RETURNING TO_JSONB(polla_current_accounts.*) AS json_row
  )
  SELECT COALESCE(array_agg(upserted_rows.json_row), '{}'::JSONB[])
  INTO result_array
  FROM upserted_rows;

  RETURN result_array;
END;
$$;

ALTER FUNCTION polla_calculate_current_account(TEXT, BOOLEAN, BOOLEAN, UUID, BOOLEAN)
  SET statement_timeout = '300000';

-- ============================================================
-- 7. Cuenta corriente: recálculo de una sola fila (edición manual)
-- ============================================================

CREATE OR REPLACE FUNCTION polla_update_current_account_recompute(
  p_polla_current_account_id UUID,
  p_props JSONB,
  p_calculate_leave BOOLEAN,
  p_organization_id UUID,
  p_leave_in_subtotal BOOLEAN DEFAULT FALSE
)
RETURNS polla_current_accounts
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cur polla_current_accounts;
  v_user_id UUID;
  v_date DATE;
  row_count INTEGER;
  v_pass_raw NUMERIC := 0;
  v_successes NUMERIC := 0;
  v_fee_pct NUMERIC := 0;
  v_fee_plus_pct NUMERIC := 0;
  v_prev_total NUMERIC := 0;
  v_prev_drag_raw NUMERIC := 0;
  v_prev_leave NUMERIC := 0;
  v_prev_bills NUMERIC := 0;
  v_prev_drag NUMERIC := 0;
  eff_claims NUMERIC := 0;
  eff_collections NUMERIC := 0;
  eff_paid NUMERIC := 0;
  eff_bills NUMERIC := 0;
  claims_pos NUMERIC := 0;
  claims_neg NUMERIC := 0;
  v_pass NUMERIC := 0;
  v_comm NUMERIC := 0;
  v_subtotal NUMERIC := 0;
  v_revenue NUMERIC := 0;
  v_total NUMERIC := 0;
  v_drag NUMERIC := 0;
  v_leave NUMERIC := 0;
  has_claims BOOLEAN := p_props ? 'claims';
  has_collections BOOLEAN := p_props ? 'collections';
  has_paid BOOLEAN := p_props ? 'paid';
  has_bills BOOLEAN := p_props ? 'bills';
  has_previous_balance BOOLEAN := p_props ? 'previous_balance';
  has_previous_drag BOOLEAN := p_props ? 'previous_drag';
BEGIN
  SELECT * INTO cur
  FROM polla_current_accounts
  WHERE polla_current_account_id = p_polla_current_account_id
    AND polla_organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_CURRENT_ACCOUNT_NOT_FOUND';
  END IF;

  v_user_id := cur.polla_user_id;
  v_date := cur.date;

  SELECT
    COALESCE(SUM(b.amount) FILTER (WHERE b.load_date = v_date), 0),
    COALESCE(SUM(b.prize) FILTER (WHERE b.winner AND b.hit_date = v_date), 0)
  INTO v_pass_raw, v_successes
  FROM polla_bets b
  WHERE b.cashier_polla_user_id = v_user_id
    AND b.deleted_at IS NULL
    AND (b.load_date = v_date OR (b.winner AND b.hit_date = v_date))
    AND b.polla_organization_id = p_organization_id;

  SELECT
    COALESCE(u.fee, 0) / 100.0,
    COALESCE(u.fee_plus, 0) / 100.0
  INTO v_fee_pct, v_fee_plus_pct
  FROM polla_users u
  WHERE u.polla_user_id = v_user_id
    AND u.deleted_at IS NULL
    AND u.polla_organization_id = p_organization_id;

  SELECT
    COALESCE(ca.total, 0),
    COALESCE(ca.drag, 0),
    COALESCE(ca.leave, 0),
    COALESCE(ca.bills, 0)
  INTO v_prev_total, v_prev_drag_raw, v_prev_leave, v_prev_bills
  FROM polla_current_accounts ca
  WHERE ca.polla_user_id = v_user_id
    AND ca.date < v_date
    AND ca.polla_organization_id = p_organization_id
  ORDER BY ca.date DESC
  LIMIT 1;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count = 0 THEN
    v_prev_total := 0;
    v_prev_drag_raw := 0;
    v_prev_leave := 0;
    v_prev_bills := 0;
  END IF;

  IF has_previous_balance THEN
    v_prev_total := (p_props->>'previous_balance')::NUMERIC;
  END IF;

  IF has_previous_drag THEN
    v_prev_drag_raw := (p_props->>'previous_drag')::NUMERIC;
    v_prev_leave := 0;
  END IF;

  v_prev_drag := CASE
    WHEN v_prev_leave > 0 AND v_prev_drag_raw > 0 THEN 0
    ELSE v_prev_drag_raw
  END;

  eff_claims := COALESCE((CASE WHEN has_claims THEN (p_props->>'claims')::NUMERIC END), cur.claims, 0);
  eff_collections := COALESCE((CASE WHEN has_collections THEN (p_props->>'collections')::NUMERIC END), cur.collections, 0);
  eff_paid := COALESCE((CASE WHEN has_paid THEN (p_props->>'paid')::NUMERIC END), cur.paid, 0);
  eff_bills := COALESCE((CASE WHEN has_bills THEN (p_props->>'bills')::NUMERIC END), v_prev_bills);

  claims_pos := GREATEST(eff_claims, 0);
  claims_neg := LEAST(eff_claims, 0);
  v_pass := v_pass_raw + claims_pos;
  v_comm := ROUND(v_pass * v_fee_pct, 2);
  v_subtotal := v_pass - v_comm - v_successes + claims_neg;
  v_revenue := v_subtotal;
  v_total := v_prev_total + v_revenue - eff_collections + eff_paid;

  IF v_fee_plus_pct > 0 THEN
    v_drag := v_prev_drag + v_revenue;
    IF p_calculate_leave THEN
      IF v_drag > 0 THEN
        v_leave := ROUND(v_drag * v_fee_plus_pct, 2);
        v_total := v_total - v_leave;
        IF p_leave_in_subtotal THEN
          v_subtotal := v_revenue - v_leave;
        END IF;
      ELSE
        v_leave := 0;
      END IF;
    ELSE
      v_leave := COALESCE(cur.leave, 0);
    END IF;
  ELSE
    v_prev_drag := 0;
    v_drag := 0;
    v_leave := 0;
  END IF;

  UPDATE polla_current_accounts ca
  SET
    claims = eff_claims,
    collections = eff_collections,
    paid = eff_paid,
    bills = eff_bills,
    pass = v_pass,
    successes = v_successes,
    cashier_commission = v_comm,
    subtotal = v_subtotal,
    revenue = v_revenue,
    previous_balance = v_prev_total,
    previous_drag = v_prev_drag,
    total = v_total,
    drag = v_drag,
    leave = v_leave,
    edited_at = NOW()
  WHERE ca.polla_current_account_id = p_polla_current_account_id
    AND ca.polla_organization_id = p_organization_id
  RETURNING * INTO cur;

  RETURN cur;
END;
$$;

-- ============================================================
-- 8. Cuenta corriente: cascada del arrastre hacia adelante
-- ============================================================

CREATE OR REPLACE FUNCTION polla_cascade_current_account_from_date(
  p_from_date_text TEXT,
  p_organization_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_from_date    DATE := to_date(p_from_date_text, 'DD-MM-YYYY');
  v_user         RECORD;
  v_record       RECORD;
  v_prev_total   NUMERIC;
  v_prev_drag    NUMERIC;
  v_anchor_drag  NUMERIC;
  v_anchor_leave NUMERIC;
  v_new_total    NUMERIC;
  v_new_drag     NUMERIC;
  v_new_leave    NUMERIC;
BEGIN
  FOR v_user IN
    SELECT DISTINCT
      ca.polla_user_id,
      COALESCE(u.fee_plus, 0) / 100.0 AS fee_plus_pct
    FROM polla_current_accounts ca
    JOIN polla_users u ON u.polla_user_id = ca.polla_user_id
    WHERE ca.date > v_from_date
      AND ca.polla_organization_id = p_organization_id
      AND (p_user_id IS NULL OR ca.polla_user_id = p_user_id)
  LOOP
    SELECT
      COALESCE(ca.total, 0),
      COALESCE(ca.drag, 0),
      COALESCE(ca.leave, 0)
    INTO v_prev_total, v_anchor_drag, v_anchor_leave
    FROM polla_current_accounts ca
    WHERE ca.polla_user_id = v_user.polla_user_id
      AND ca.date = v_from_date
      AND ca.polla_organization_id = p_organization_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_anchor_leave > 0 AND v_anchor_drag > 0 THEN
      v_prev_drag := 0;
    ELSE
      v_prev_drag := v_anchor_drag;
    END IF;

    FOR v_record IN
      SELECT *
      FROM polla_current_accounts
      WHERE polla_user_id = v_user.polla_user_id
        AND date > v_from_date
        AND polla_organization_id = p_organization_id
      ORDER BY date ASC
    LOOP
      v_new_total := v_prev_total
                   + COALESCE(v_record.subtotal, 0)
                   - COALESCE(v_record.collections, 0)
                   + COALESCE(v_record.paid, 0);

      IF v_user.fee_plus_pct > 0 THEN
        v_new_drag := v_prev_drag + COALESCE(v_record.subtotal, 0);
      ELSE
        v_new_drag := 0;
      END IF;

      IF COALESCE(v_record.leave, 0) > 0 THEN
        IF v_new_drag > 0 THEN
          v_new_leave := ROUND(v_new_drag * v_user.fee_plus_pct, 2);
        ELSE
          v_new_leave := 0;
        END IF;
        v_new_total := v_new_total - v_new_leave;
      ELSE
        v_new_leave := 0;
      END IF;

      UPDATE polla_current_accounts
      SET
        previous_balance = v_prev_total,
        previous_drag    = v_prev_drag,
        total            = v_new_total,
        drag             = v_new_drag,
        leave            = v_new_leave,
        edited_at        = NOW()
      WHERE polla_current_account_id = v_record.polla_current_account_id;

      v_prev_total := v_new_total;
      IF v_new_leave > 0 AND v_new_drag > 0 THEN
        v_prev_drag := 0;
      ELSE
        v_prev_drag := v_new_drag;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ============================================================
-- 9. Orquestador diario (equivalente a generate_winners_and_calculate_accounts)
-- ============================================================

CREATE OR REPLACE FUNCTION polla_process_results_and_accounts(
  p_organization_id UUID,
  p_schedule_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lottery RECORD;
  v_results JSONB[] := '{}';
  v_accounts JSONB[];
BEGIN
  FOR v_lottery IN
    SELECT DISTINCT polla_lottery_id
    FROM polla_results
    WHERE polla_organization_id = p_organization_id
      AND polla_schedule_id = p_schedule_id
      AND date = p_date
      AND deleted_at IS NULL
  LOOP
    v_results := v_results || polla_process_edition_hits(
      p_organization_id,
      v_lottery.polla_lottery_id,
      p_schedule_id,
      p_date
    );
  END LOOP;

  v_accounts := polla_calculate_current_account(
    to_char(p_date, 'DD-MM-YYYY'),
    FALSE,
    FALSE,
    p_organization_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'polla_organization_id', p_organization_id,
    'polla_schedule_id', p_schedule_id,
    'date', p_date,
    'editions', to_jsonb(v_results),
    'accounts_updated', COALESCE(array_length(v_accounts, 1), 0)
  );
END;
$$;

ALTER FUNCTION polla_process_results_and_accounts(UUID, UUID, DATE)
  SET statement_timeout = '300000';
