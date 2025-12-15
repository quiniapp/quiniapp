-- ============================================================================
-- Migración: Agregar organization_id a todos los Stored Procedures
-- ============================================================================
-- Esta migración actualiza todos los stored procedures para agregar el parámetro
-- p_organization_id UUID y filtrar por organización en todas las queries.
-- ============================================================================

-- ============================================================================
-- 1. create_ticket_with_bets
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_ticket_with_bets(jsonb);

CREATE OR REPLACE FUNCTION public.create_ticket_with_bets(
  ticket jsonb,
  p_organization_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_ticket_id uuid;
  v_now timestamptz := now();
  v_total numeric := 0;
  v_created_base timestamptz;
BEGIN
  -- 0) Calcular total = suma(amount * cantidad_de_combinaciones)
  WITH bets AS (
    SELECT b
    FROM jsonb_array_elements(ticket->'bets') AS b
  ),
  combos AS (
    SELECT
      (b.b->>'amount')::numeric AS amount,
      coalesce(sum(jsonb_array_length(sl->'lotteries')),0) AS combos_count
    FROM bets b
    LEFT JOIN LATERAL jsonb_array_elements(b.b->'scheduleLottery') AS sl ON true
    GROUP BY b.b
  )
  SELECT coalesce(sum(amount * combos_count), 0) INTO v_total
  FROM combos;

  -- 1) Insertar ticket (cabecera) con organization_id
  INSERT INTO public.tickets (
    ticket_id, user_id, user_name, ticket_number, date,
    paid, winner, total, total_prize,
    created_at, deleted_at, deleted_by, hits, organization_id
  )
  VALUES (
    (ticket->>'ticket_id')::uuid,
    nullif(ticket->>'user_id','')::uuid,
    ticket->>'user_name',
    ticket->>'ticket_number',
    (ticket->>'date')::date,
    false,
    false,
    v_total,
    0,
    coalesce((ticket->>'created_at')::timestamptz, v_now),
    null,
    null,
    0,
    p_organization_id
  )
  RETURNING ticket_id, created_at INTO v_ticket_id, v_created_base;

  -- 2) Bulk insert de bets preservando orden por BLOQUE (ordinalidad del bet en el JSON)
  WITH raw_bets AS (
    SELECT
      v_ticket_id AS ticket_id,
      (ticket->>'user_id')::uuid AS user_id,
      ticket->>'user_name' AS user_name,
      (ticket->>'ticket_number') AS ticket_number,
      (ticket->>'date')::date AS date,
      b->>'number' AS number,
      (b->>'amount')::numeric AS amount,
      (b->>'place')::place_type_enum AS place,
      nullif(b->>'with','') AS "with",
      nullif(b->>'position','')::place_type_enum AS position,
      (b->'scheduleLottery')::jsonb AS schedule_lottery,
      bet_idx AS bet_ord
    FROM jsonb_array_elements(ticket->'bets') WITH ORDINALITY AS b(b, bet_idx)
  ),
  exploded AS (
    SELECT
      rb.*,
      sl->>'schedule' AS schedule_id_text,
      (sl->'lotteries')::jsonb AS lotteries_json,
      sched_idx AS sched_ord
    FROM raw_bets rb
    CROSS JOIN LATERAL jsonb_array_elements(rb.schedule_lottery) WITH ORDINALITY AS sl(sl, sched_idx)
  ),
  cartesian AS (
    SELECT
      ticket_id, user_id, user_name, ticket_number, date,
      number, amount, place, "with", position,
      (schedule_id_text)::uuid AS schedule_id,
      (lot_el)::uuid AS lottery_id,
      bet_ord, sched_ord, lot_ord
    FROM exploded
    CROSS JOIN LATERAL jsonb_array_elements_text(lotteries_json) WITH ORDINALITY AS lot(lot_el, lot_ord)
  ),
  numbered AS (
    SELECT
      c.*,
      bet_ord AS bet_group_order,
      row_number() over (
        PARTITION BY bet_ord
        ORDER BY sched_ord, lot_ord
      ) AS combo_rn
    FROM cartesian c
  ),
  prepared AS (
    SELECT
      gen_random_uuid() AS bet_id,
      (
        CASE
          WHEN length(number) = 1 THEN 'ONE'
          WHEN length(number) = 2 AND coalesce(length("with"),0) = 0 THEN 'DOUBLE'
          WHEN length(number) = 2 AND coalesce(length("with"),0) = 2 THEN 'REDOUBLE'
          WHEN length(number) = 3 THEN 'TERN'
          WHEN length(number) = 4 THEN 'QUATERN'
          WHEN length(number) = 10 THEN 'BORRATINA'
          ELSE null
        END
      )::bet_type_enum AS bet_type,
      ticket_id,
      user_id,
      number,
      amount,
      place,
      "with",
      position,
      date,
      false AS winner,
      false AS paid,
      lottery_id,
      schedule_id,
      ticket_number,
      user_name AS cashier_name,
      0 AS hits,
      bet_group_order AS bet_order,
      v_created_base AS created_at,
      combo_rn,
      p_organization_id AS organization_id
    FROM numbered
  )
  INSERT INTO public.bets (
    bet_id, bet_type, ticket_id, user_id, number, amount, place, "with", position,
    date, winner, paid, lottery_id, schedule_id, ticket_number, cashier_name, hits,
    bet_order, created_at, organization_id
  )
  SELECT
    bet_id, bet_type, ticket_id, user_id, number, amount, place, "with", position,
    date, winner, paid, lottery_id, schedule_id, ticket_number, cashier_name, hits,
    bet_order, created_at, organization_id
  FROM prepared
  ORDER BY bet_order, combo_rn;

  -- 3) Retornar hidratado
  RETURN public.ticket_full_json_plpgsql(v_ticket_id, p_organization_id);
EXCEPTION
  WHEN others THEN
    RAISE;
END;
$$;

-- ============================================================================
-- 2. edit_ticket_replace_bets
-- ============================================================================
DROP FUNCTION IF EXISTS public.edit_ticket_replace_bets(UUID, jsonb);

CREATE OR REPLACE FUNCTION public.edit_ticket_replace_bets(
  p_ticket_id UUID,
  p_bets jsonb,
  p_organization_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_ticket_row tickets%rowtype;
  v_now timestamptz := now();
  v_total numeric := 0;
  v_created_base timestamptz;
BEGIN
  -- 1) Traer y bloquear el ticket
  SELECT * INTO v_ticket_row
  FROM public.tickets
  WHERE ticket_id = p_ticket_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket % no existe', p_ticket_id USING errcode = 'P0002';
  END IF;

  v_created_base := v_ticket_row.created_at;

  -- 2) Borrar todas las bets actuales del ticket
  DELETE FROM public.bets
  WHERE ticket_id = p_ticket_id
    AND organization_id = p_organization_id;

  -- 3) Recalcular total desde p_bets
  WITH bets AS (
    SELECT b
    FROM jsonb_array_elements(p_bets) AS b
  ),
  combos AS (
    SELECT
      (b.b->>'amount')::numeric AS amount,
      coalesce(sum(jsonb_array_length(sl->'lotteries')), 0) AS combos_count
    FROM bets b
    LEFT JOIN LATERAL jsonb_array_elements(b.b->'scheduleLottery') AS sl ON true
    GROUP BY b.b
  )
  SELECT coalesce(sum(amount * combos_count), 0) INTO v_total
  FROM combos;

  -- 4) Actualizar cabecera
  UPDATE public.tickets t
  SET total = v_total,
      paid = false,
      winner = false,
      hits = 0,
      total_prize = 0
  WHERE t.ticket_id = p_ticket_id
    AND t.organization_id = p_organization_id;

  -- 5) Insertar nuevas bets preservando orden por BLOQUE
  WITH raw_bets AS (
    SELECT
      p_ticket_id AS ticket_id,
      v_ticket_row.user_id AS user_id,
      v_ticket_row.user_name AS user_name,
      v_ticket_row.ticket_number AS ticket_number,
      v_ticket_row.date AS date,
      b->>'number' AS number,
      (b->>'amount')::numeric AS amount,
      (b->>'place')::place_type_enum AS place,
      nullif(b->>'with','') AS "with",
      nullif(b->>'position','')::place_type_enum AS position,
      (b->'scheduleLottery')::jsonb AS schedule_lottery,
      bet_idx AS bet_ord
    FROM jsonb_array_elements(p_bets) WITH ORDINALITY AS b(b, bet_idx)
  ),
  exploded AS (
    SELECT
      rb.*,
      sl->>'schedule' AS schedule_id_text,
      (sl->'lotteries')::jsonb AS lotteries_json,
      sched_idx AS sched_ord
    FROM raw_bets rb
    CROSS JOIN LATERAL jsonb_array_elements(rb.schedule_lottery) WITH ORDINALITY AS sl(sl, sched_idx)
  ),
  cartesian AS (
    SELECT
      ticket_id, user_id, user_name, ticket_number, date,
      number, amount, place, "with", position,
      (schedule_id_text)::uuid AS schedule_id,
      (lot_el)::uuid AS lottery_id,
      bet_ord, sched_ord, lot_ord
    FROM exploded
    CROSS JOIN LATERAL jsonb_array_elements_text(lotteries_json) WITH ORDINALITY AS lot(lot_el, lot_ord)
  ),
  numbered AS (
    SELECT
      c.*,
      bet_ord AS bet_group_order,
      row_number() OVER (
        PARTITION BY bet_ord
        ORDER BY sched_ord, lot_ord
      ) AS combo_rn
    FROM cartesian c
  ),
  prepared AS (
    SELECT
      gen_random_uuid() AS bet_id,
      (
        CASE
          WHEN length(number) = 1 THEN 'ONE'
          WHEN length(number) = 2 AND coalesce(length("with"),0) = 0 THEN 'DOUBLE'
          WHEN length(number) = 2 AND coalesce(length("with"),0) = 2 THEN 'REDOUBLE'
          WHEN length(number) = 3 THEN 'TERN'
          WHEN length(number) = 4 THEN 'QUATERN'
          WHEN length(number) = 10 THEN 'BORRATINA'
          ELSE null
        END
      )::bet_type_enum AS bet_type,
      ticket_id,
      user_id,
      number,
      amount,
      place,
      "with",
      position,
      date,
      false AS winner,
      false AS paid,
      lottery_id,
      schedule_id,
      ticket_number,
      user_name AS cashier_name,
      0 AS hits,
      bet_group_order AS bet_order,
      v_created_base AS created_at,
      combo_rn,
      p_organization_id AS organization_id
    FROM numbered
  )
  INSERT INTO public.bets (
    bet_id, bet_type, ticket_id, user_id, number, amount, place, "with", position,
    date, winner, paid, lottery_id, schedule_id, ticket_number, cashier_name, hits,
    bet_order, created_at, organization_id
  )
  SELECT
    bet_id, bet_type, ticket_id, user_id, number, amount, place, "with", position,
    date, winner, paid, lottery_id, schedule_id, ticket_number, cashier_name, hits,
    bet_order, created_at, organization_id
  FROM prepared
  ORDER BY bet_order, combo_rn;

  -- 6) Devolver ticket hidratado
  RETURN public.ticket_full_json_plpgsql(p_ticket_id, p_organization_id);
END;
$$;

-- ============================================================================
-- 3. ticket_full_json_plpgsql
-- ============================================================================
DROP FUNCTION IF EXISTS public.ticket_full_json_plpgsql(UUID);

CREATE OR REPLACE FUNCTION public.ticket_full_json_plpgsql(
  p_ticket_id UUID,
  p_organization_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH t AS (
    SELECT *
    FROM public.tickets
    WHERE ticket_id = p_ticket_id
      AND organization_id = p_organization_id
  ),
  br AS (
    SELECT
      b.ticket_id,
      b.number,
      b.amount,
      b.place,
      b."with",
      b.position,
      b.bet_order,
      s.schedule_id,
      s."time" AS schedule_time,
      jsonb_build_object(
        'schedule_id', s.schedule_id,
        'name', s.name,
        'time', to_char(s."time", 'HH24:MI:SS')
      ) AS schedule_obj,
      l.lottery_id,
      l.created_at AS lottery_created_at,
      jsonb_build_object(
        'lottery_id', l.lottery_id,
        'name', l.name
      ) AS lottery_obj
    FROM public.bets b
    JOIN public.schedules s ON s.schedule_id = b.schedule_id AND s.organization_id = p_organization_id
    JOIN public.lotteries l ON l.lottery_id = b.lottery_id AND l.organization_id = p_organization_id
    WHERE b.ticket_id = p_ticket_id
      AND b.organization_id = p_organization_id
  ),
  br_dedup AS (
    SELECT DISTINCT ON (
      ticket_id, bet_order, number, amount, place, "with", position, schedule_id, lottery_id
    )
      ticket_id, number, amount, place, "with", position,
      schedule_id, schedule_time, schedule_obj,
      lottery_id, lottery_created_at, lottery_obj,
      bet_order
    FROM br
    ORDER BY
      ticket_id, bet_order, number, amount, place, "with", position, schedule_id, lottery_id,
      lottery_created_at DESC
  ),
  bet_sched AS (
    SELECT
      bet_order,
      number, amount, place, "with", position,
      schedule_id, schedule_obj, schedule_time,
      jsonb_agg(lottery_obj ORDER BY lottery_created_at DESC) AS lotteries
    FROM br_dedup
    GROUP BY bet_order, number, amount, place, "with", position, schedule_id, schedule_obj, schedule_time
  ),
  bets_grouped AS (
    SELECT
      bet_order,
      number, amount, place, "with", position,
      jsonb_agg(
        jsonb_build_object(
          'schedule', schedule_obj,
          'lotteries', lotteries
        )
        ORDER BY schedule_time ASC
      ) AS scheduleLottery
    FROM bet_sched
    GROUP BY bet_order, number, amount, place, "with", position
  ),
  bets_json AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'number', number,
        'amount', amount,
        'place', place,
        'with', "with",
        'position', position,
        'scheduleLottery', scheduleLottery
      )
      ORDER BY bet_order ASC
    ) AS bets
    FROM bets_grouped
  )
  SELECT
    jsonb_build_object(
      'ticket_id', t.ticket_id,
      'user_id', t.user_id,
      'user_name', t.user_name,
      'ticket_number', t.ticket_number,
      'date', t.date,
      'paid', t.paid,
      'winner', t.winner,
      'total', t.total,
      'total_prize', t.total_prize,
      'created_at', t.created_at,
      'deleted_at', t.deleted_at,
      'deleted_by', t.deleted_by,
      'hits', t.hits,
      'bets', coalesce(bj.bets, '[]'::jsonb)
    )
  INTO v_result
  FROM t
  CROSS JOIN bets_json bj;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 4. pay_ticket
-- ============================================================================
DROP FUNCTION IF EXISTS pay_ticket(TEXT, UUID);

CREATE OR REPLACE FUNCTION pay_ticket(
  p_ticket_number TEXT,
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_id UUID;
  v_ticket_user_id UUID;
  v_ticket_paid BOOLEAN;
  v_bets_updated INTEGER;
  v_current_timestamp TIMESTAMPTZ;
BEGIN
  v_current_timestamp := NOW();

  -- 1. Verificar que el ticket existe y obtener sus datos
  SELECT ticket_id, user_id, paid
  INTO v_ticket_id, v_ticket_user_id, v_ticket_paid
  FROM tickets
  WHERE ticket_number = p_ticket_number
    AND organization_id = p_organization_id
    AND paid = FALSE
    AND winner = TRUE
    AND deleted_at IS NULL;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  IF v_ticket_user_id != p_user_id THEN
    RAISE EXCEPTION 'TICKET_NOT_OWNED';
  END IF;

  -- 2. Validar que el ticket no está ya pagado
  IF v_ticket_paid = TRUE THEN
    RAISE EXCEPTION 'TICKET_ALREADY_PAID';
  END IF;

  -- 3. Actualizar el ticket como pagado
  UPDATE tickets
  SET paid = TRUE
  WHERE ticket_id = v_ticket_id
    AND organization_id = p_organization_id;

  -- 4. Actualizar todas las bets ganadoras del ticket como pagadas
  UPDATE bets
  SET paid = TRUE,
      edited_at = v_current_timestamp
  WHERE ticket_id = v_ticket_id
    AND organization_id = p_organization_id
    AND winner = TRUE
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_bets_updated = ROW_COUNT;

  -- 5. Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'bets_updated', v_bets_updated
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ============================================================================
-- 5. generate_winners
-- ============================================================================
DROP FUNCTION IF EXISTS generate_winners(UUID, DATE);

CREATE OR REPLACE FUNCTION generate_winners(
  target_id UUID,
  bet_date DATE,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_affected_tickets INT := 0;
  v_winner_tickets INT := 0;
BEGIN
  WITH
  calculated_payouts AS (
    SELECT
      b.bet_id,
      b.ticket_id,
      COALESCE(cp.payout, 0::NUMERIC) AS payout,
      COALESCE(cp.hits, 0::INT) AS hits
    FROM bets b
    JOIN results r
      ON b.lottery_id = r.lottery_id
     AND b.schedule_id = r.schedule_id
     AND b.date = r.date
     AND b.organization_id = r.organization_id
     AND r.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT payout, hits FROM calculate_one_payout(b, r.results) WHERE b.bet_type = 'ONE'
      UNION ALL
      SELECT payout, hits FROM calculate_double_payout(b, r.results) WHERE b.bet_type = 'DOUBLE'
      UNION ALL
      SELECT payout, hits FROM calculate_tern_payout(b, r.results) WHERE b.bet_type = 'TERN'
      UNION ALL
      SELECT payout, hits FROM calculate_quatern_payout(b, r.results) WHERE b.bet_type = 'QUATERN'
      UNION ALL
      SELECT payout, hits FROM calculate_borratina_payout(b, r.results) WHERE b.bet_type = 'BORRATINA'
      UNION ALL
      SELECT payout, hits FROM calculate_redouble_payout(b, r.results) WHERE b.bet_type = 'REDOUBLE'
    ) cp ON TRUE
    WHERE b.schedule_id = target_id
      AND b.date = bet_date
      AND b.organization_id = p_organization_id
      AND b.deleted_at IS NULL
  ),
  up_bets AS (
    UPDATE bets b
    SET prize = cp.payout,
        hits = cp.hits,
        winner = (cp.payout > 0)
    FROM calculated_payouts cp
    WHERE b.bet_id = cp.bet_id
      AND b.organization_id = p_organization_id
    RETURNING b.ticket_id, cp.payout, cp.hits
  ),
  per_ticket_turn AS (
    SELECT
      ticket_id,
      SUM(payout) AS prize_turn,
      SUM(hits) AS hits_turn
    FROM up_bets
    GROUP BY ticket_id
  ),
  deleted_turn AS (
    DELETE FROM ticket_prizes_by_turn tpt
    WHERE tpt.schedule_id = target_id
      AND tpt.date = bet_date
      AND tpt.organization_id = p_organization_id
    RETURNING tpt.ticket_id
  ),
  affected_tickets AS (
    SELECT ticket_id FROM per_ticket_turn
    UNION
    SELECT ticket_id FROM deleted_turn
  ),
  inserted_turn AS (
    INSERT INTO ticket_prizes_by_turn
      (ticket_id, schedule_id, date, prize_turn, hits_turn, updated_at, organization_id)
    SELECT
      p.ticket_id,
      target_id,
      bet_date,
      p.prize_turn,
      p.hits_turn,
      NOW(),
      p_organization_id
    FROM per_ticket_turn p
  ),
  previous_turns AS (
    SELECT
      tpt.ticket_id,
      SUM(tpt.prize_turn) AS prize_prev,
      SUM(tpt.hits_turn) AS hits_prev
    FROM ticket_prizes_by_turn tpt
    JOIN affected_tickets at ON at.ticket_id = tpt.ticket_id
    WHERE tpt.date = bet_date
      AND tpt.schedule_id <> target_id
      AND tpt.organization_id = p_organization_id
    GROUP BY tpt.ticket_id
  ),
  totals_per_day AS (
    SELECT
      ticket_id,
      SUM(prize) AS total_prize,
      SUM(hits) AS total_hits
    FROM (
      SELECT
        p.ticket_id,
        p.prize_turn AS prize,
        p.hits_turn AS hits
      FROM per_ticket_turn p
      UNION ALL
      SELECT
        pt.ticket_id,
        pt.prize_prev AS prize,
        pt.hits_prev AS hits
      FROM previous_turns pt
    ) s
    GROUP BY ticket_id
  ),
  updated_tickets AS (
    UPDATE tickets t
    SET total_prize = COALESCE(tt.total_prize, 0),
        hits = COALESCE(tt.total_hits, 0),
        winner = (COALESCE(tt.total_prize, 0) > 0)
    FROM affected_tickets at
    LEFT JOIN totals_per_day tt ON tt.ticket_id = at.ticket_id
    WHERE t.ticket_id = at.ticket_id
      AND t.date = bet_date
      AND t.organization_id = p_organization_id
    RETURNING t.ticket_id, (COALESCE(tt.total_prize, 0) > 0) as is_winner
  )
  SELECT
    COUNT(*)::INT as total,
    COUNT(*) FILTER (WHERE is_winner)::INT as winners
  INTO v_affected_tickets, v_winner_tickets
  FROM updated_tickets;

  RETURN jsonb_build_object(
    'success', true,
    'schedule_id', target_id,
    'date', bet_date,
    'affected_tickets', COALESCE(v_affected_tickets, 0),
    'winner_tickets', COALESCE(v_winner_tickets, 0)
  );
END;
$$;

-- ============================================================================
-- 6. generate_winners_and_calculate_accounts (llamará a las funciones actualizadas)
-- ============================================================================
-- Esta función ya llama a generate_winners y calculate_current_account,
-- solo necesitamos actualizar su firma para aceptar organization_id
DROP FUNCTION IF EXISTS generate_winners_and_calculate_accounts(UUID, DATE);

CREATE OR REPLACE FUNCTION generate_winners_and_calculate_accounts(
  p_schedule_id UUID,
  p_date DATE,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_winners_result JSONB;
  v_current_account_result JSONB[];
  v_date_text TEXT;
BEGIN
  -- 1. Generar ganadores (ahora con organization_id)
  v_winners_result := generate_winners(p_schedule_id, p_date, p_organization_id);

  -- 2. Calcular cuentas corrientes (ahora con organization_id)
  v_date_text := to_char(p_date, 'DD-MM-YYYY');
  v_current_account_result := calculate_current_account(v_date_text, false, false, p_organization_id);

  -- 3. Retornar resultado combinado
  RETURN jsonb_build_object(
    'success', true,
    'winners', v_winners_result,
    'current_accounts_updated', jsonb_array_length(to_jsonb(v_current_account_result))
  );
END;
$$;

-- ============================================================================
-- 7. calculate_current_account
-- ============================================================================
DROP FUNCTION IF EXISTS calculate_current_account(TEXT, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION calculate_current_account(
  p_date_text TEXT,
  p_calculate_leave BOOLEAN DEFAULT FALSE,
  p_liquidated BOOLEAN DEFAULT FALSE,
  p_organization_id UUID DEFAULT NULL
)
RETURNS JSONB[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_date DATE := to_date(p_date_text, 'DD-MM-YYYY');
  result_array JSONB[];
BEGIN
  WITH
  daily_activity AS (
    SELECT
      t.user_id,
      COALESCE(SUM(t.total), 0) AS pass_raw,
      COALESCE(SUM(t.total_prize), 0) AS successes
    FROM tickets t
    WHERE t.date = v_date
      AND t.deleted_at IS NULL
      AND (p_organization_id IS NULL OR t.organization_id = p_organization_id)
    GROUP BY t.user_id
  ),
  previous_state AS (
    SELECT DISTINCT ON (ca.user_id)
      ca.user_id,
      ca.total AS previous_balance,
      ca.drag AS previous_drag_raw,
      ca.leave AS previous_leave,
      ca.bills AS previous_bills
    FROM current_accounts ca
    WHERE ca.date < v_date
      AND (p_organization_id IS NULL OR ca.organization_id = p_organization_id)
    ORDER BY ca.user_id, ca.date DESC
  ),
  existing_day AS (
    SELECT
      ca.user_id,
      COALESCE(ca.claims, 0) AS claims,
      COALESCE(ca.collections, 0) AS collections,
      COALESCE(ca.paid, 0) AS paid,
      COALESCE(ca.leave, 0) AS leave,
      COALESCE(ca.previous_balance, 0) AS previous_balance_today,
      COALESCE(ca.previous_drag, 0) AS previous_drag_today
    FROM current_accounts ca
    WHERE ca.date = v_date
      AND (p_organization_id IS NULL OR ca.organization_id = p_organization_id)
  ),
  calculated_data AS (
    SELECT
      u.user_id,
      u.name AS user_name,
      u.number AS user_number,
      COALESCE(da.pass_raw, 0) AS pass_raw,
      COALESCE(da.successes, 0) AS successes,
      COALESCE(ed.claims, 0) AS claims,
      GREATEST(COALESCE(ed.claims, 0), 0) AS claims_pos,
      LEAST(COALESCE(ed.claims, 0), 0) AS claims_neg,
      COALESCE(ed.collections, 0) AS collections,
      COALESCE(ed.paid, 0) AS paid,
      COALESCE(ed.leave, 0) AS leave_manual,
      COALESCE(ed.previous_balance_today, ps.previous_balance, 0) AS prev_balance_chosen,
      COALESCE(u.fee, 0) / 100.0 AS fee_pct,
      COALESCE(u.fee_plus, 0) / 100.0 AS fee_plus_pct,
      CASE
        WHEN COALESCE(u.fee_plus, 0) <= 0 THEN 0
        WHEN p_calculate_leave AND COALESCE(ps.previous_leave, 0) > 0 AND COALESCE(ps.previous_drag_raw, 0) > 0 THEN 0
        ELSE COALESCE(ps.previous_drag_raw, 0)
      END AS prev_drag_eff_hist,
      CASE
        WHEN COALESCE(u.fee_plus, 0) <= 0 THEN 0
        ELSE COALESCE(
          ed.previous_drag_today,
          CASE
            WHEN p_calculate_leave AND COALESCE(ps.previous_leave, 0) > 0 AND COALESCE(ps.previous_drag_raw, 0) > 0 THEN 0
            ELSE COALESCE(ps.previous_drag_raw, 0)
          END,
          0
        )
      END AS prev_drag_eff_chosen
    FROM users u
    LEFT JOIN daily_activity da ON u.user_id = da.user_id
    LEFT JOIN previous_state ps ON u.user_id = ps.user_id
    LEFT JOIN existing_day ed ON u.user_id = ed.user_id
    WHERE u.user_type = 'CASHIER'
      AND u.deleted_at IS NULL
      AND (p_organization_id IS NULL OR u.organization_id = p_organization_id)
  ),
  final_data AS (
    SELECT
      cd.*,
      ((cd.pass_raw + GREATEST(cd.claims, 0))
        - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
        - cd.successes
        + LEAST(cd.claims, 0)) AS revenue,
      (cd.pass_raw + GREATEST(cd.claims, 0)) AS pass,
      ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2) AS cashier_commission,
      ((cd.pass_raw + GREATEST(cd.claims, 0))
       - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
       - cd.successes
       + LEAST(cd.claims, 0)) AS subtotal,
      COALESCE(ps.previous_bills, 0) AS bills,
      (cd.prev_balance_chosen
       + (cd.pass_raw + GREATEST(cd.claims, 0)
          - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
          - cd.successes
          + LEAST(cd.claims, 0))
       - cd.collections
       + cd.paid) AS total_pre_leave,
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        ELSE cd.prev_drag_eff_chosen
             + (cd.pass_raw + GREATEST(cd.claims, 0)
                - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
                - cd.successes
                + LEAST(cd.claims, 0))
      END AS drag_calc,
      CASE
        WHEN cd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave
          THEN CASE WHEN (cd.prev_drag_eff_chosen
                          + (cd.pass_raw + GREATEST(cd.claims, 0)
                             - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
                             - cd.successes
                             + LEAST(cd.claims, 0))) > 0
                    THEN ROUND((cd.prev_drag_eff_chosen
                       + (cd.pass_raw + GREATEST(cd.claims, 0)
                          - ROUND((cd.pass_raw + GREATEST(cd.claims, 0)) * cd.fee_pct, 2)
                          - cd.successes
                          + LEAST(cd.claims, 0))) * cd.fee_plus_pct, 2)
                    ELSE 0
               END
        ELSE cd.leave_manual
      END AS leave_calc
    FROM calculated_data cd
    LEFT JOIN previous_state ps ON ps.user_id = cd.user_id
  ),
  resolved AS (
    SELECT
      fd.*,
      CASE
        WHEN fd.fee_plus_pct <= 0 THEN 0
        WHEN p_calculate_leave THEN fd.leave_calc
        ELSE COALESCE(fd.leave_manual, 0)
      END AS leave_effective,
      (fd.total_pre_leave
       - CASE
           WHEN fd.fee_plus_pct <= 0 THEN 0
           WHEN p_calculate_leave THEN fd.leave_calc
           ELSE COALESCE(fd.leave_manual, 0)
         END) AS total_final,
      CASE WHEN fd.fee_plus_pct <= 0 THEN 0 ELSE fd.prev_drag_eff_chosen END AS previous_drag_to_store,
      fd.prev_balance_chosen AS previous_balance_to_store,
      CASE
        WHEN fd.fee_plus_pct <= 0 THEN 0
        ELSE fd.prev_drag_eff_chosen + fd.subtotal
      END AS drag_to_store
    FROM final_data fd
  ),
  upserted_rows AS (
    INSERT INTO current_accounts (
      current_account_id,
      user_id, user_name, user_number,
      pass, successes, claims,
      subtotal, previous_balance, collections, paid,
      total, drag, leave, date,
      created_at, edited_at,
      cashier_commission, bills, revenue, previous_drag,
      is_liquidated, organization_id
    )
    SELECT
      gen_random_uuid(),
      r.user_id, r.user_name, r.user_number,
      r.pass, r.successes, r.claims,
      r.subtotal, r.previous_balance_to_store, r.collections, r.paid,
      r.total_final, r.drag_to_store,
      CASE WHEN p_calculate_leave THEN r.leave_calc ELSE COALESCE(r.leave_manual, 0) END,
      v_date,
      NOW(), NOW(),
      r.cashier_commission, r.bills, r.revenue, r.previous_drag_to_store,
      CASE WHEN p_liquidated THEN TRUE ELSE FALSE END,
      p_organization_id
    FROM resolved r
    ON CONFLICT (user_id, date) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      user_number = EXCLUDED.user_number,
      pass = EXCLUDED.pass,
      successes = EXCLUDED.successes,
      claims = current_accounts.claims,
      collections = current_accounts.collections,
      paid = current_accounts.paid,
      leave = CASE
                WHEN p_calculate_leave THEN EXCLUDED.leave
                ELSE current_accounts.leave
              END,
      subtotal = EXCLUDED.subtotal,
      previous_balance = current_accounts.previous_balance,
      total = EXCLUDED.total,
      drag = EXCLUDED.drag,
      edited_at = NOW(),
      cashier_commission = EXCLUDED.cashier_commission,
      bills = EXCLUDED.bills,
      revenue = EXCLUDED.revenue,
      previous_drag = current_accounts.previous_drag,
      is_liquidated = CASE
                        WHEN p_liquidated THEN TRUE
                        ELSE current_accounts.is_liquidated
                      END
    RETURNING TO_JSONB(current_accounts.*) AS json_row
  )
  SELECT COALESCE(array_agg(upserted_rows.json_row), '{}'::JSONB[])
  INTO result_array
  FROM upserted_rows;

  RETURN result_array;
END;
$$;

-- ============================================================================
-- 8. update_current_account_recompute
-- ============================================================================
DROP FUNCTION IF EXISTS update_current_account_recompute(UUID, JSONB, BOOLEAN);

CREATE OR REPLACE FUNCTION update_current_account_recompute(
  p_current_account_id UUID,
  p_props JSONB,
  p_calculate_leave BOOLEAN,
  p_organization_id UUID
)
RETURNS current_accounts
LANGUAGE plpgsql
AS $$
DECLARE
  cur current_accounts;
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
BEGIN
  -- 1) Fila actual (lock)
  SELECT * INTO cur
  FROM current_accounts
  WHERE current_account_id = p_current_account_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'current_account_id % no existe', p_current_account_id;
  END IF;

  v_user_id := cur.user_id;
  v_date := cur.date::date;

  -- 2) Tickets del día
  SELECT
    COALESCE(SUM(t.total), 0),
    COALESCE(SUM(t.total_prize), 0)
  INTO v_pass_raw, v_successes
  FROM tickets t
  WHERE t.user_id = v_user_id
    AND t.date = v_date
    AND t.deleted_at IS NULL
    AND t.organization_id = p_organization_id;

  -- 3) Fee y fee_plus del usuario
  SELECT
    COALESCE(u.fee, 0) / 100.0,
    COALESCE(u.fee_plus, 0) / 100.0
  INTO v_fee_pct, v_fee_plus_pct
  FROM users u
  WHERE u.user_id = v_user_id
    AND u.deleted_at IS NULL
    AND u.organization_id = p_organization_id;

  -- 4) Estado anterior
  SELECT
    COALESCE(ca.total, 0),
    COALESCE(ca.drag, 0),
    COALESCE(ca.leave, 0),
    COALESCE(ca.bills, 0)
  INTO
    v_prev_total,
    v_prev_drag_raw,
    v_prev_leave,
    v_prev_bills
  FROM current_accounts ca
  WHERE ca.user_id = v_user_id
    AND ca.date < v_date
    AND ca.organization_id = p_organization_id
  ORDER BY ca.date DESC
  LIMIT 1;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count = 0 THEN
    v_prev_total := 0;
    v_prev_drag_raw := 0;
    v_prev_leave := 0;
    v_prev_bills := 0;
  END IF;

  v_prev_drag := CASE
    WHEN v_prev_leave > 0 AND v_prev_drag_raw > 0 THEN 0
    ELSE v_prev_drag_raw
  END;

  -- 5) Manuales efectivos
  eff_claims := COALESCE((CASE WHEN has_claims THEN (p_props->>'claims')::NUMERIC END), cur.claims, 0);
  eff_collections := COALESCE((CASE WHEN has_collections THEN (p_props->>'collections')::NUMERIC END), cur.collections, 0);
  eff_paid := COALESCE((CASE WHEN has_paid THEN (p_props->>'paid')::NUMERIC END), cur.paid, 0);
  eff_bills := COALESCE((CASE WHEN has_bills THEN (p_props->>'bills')::NUMERIC END), v_prev_bills);

  -- 6) Reglas base del día
  claims_pos := GREATEST(eff_claims, 0);
  claims_neg := LEAST(eff_claims, 0);
  v_pass := v_pass_raw + claims_pos;
  v_comm := ROUND(v_pass * v_fee_pct, 2);
  v_subtotal := v_pass - v_comm - v_successes + claims_neg;
  v_revenue := v_subtotal;
  v_total := v_prev_total + v_revenue - eff_collections + eff_paid;

  -- 7) DRAG y LEAVE con condición de fee_plus
  IF v_fee_plus_pct > 0 THEN
    v_drag := v_prev_drag + v_revenue;
    IF p_calculate_leave THEN
      IF v_drag > 0 THEN
        v_leave := ROUND(v_drag * v_fee_plus_pct, 2);
        v_total := v_total - v_leave;
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

  -- 8) Update y retorno
  UPDATE current_accounts ca
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
  WHERE ca.current_account_id = p_current_account_id
    AND ca.organization_id = p_organization_id
  RETURNING * INTO cur;

  RETURN cur;
END;
$$;

-- ============================================================================
-- 9. get_grouped_bets_for_parse
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_grouped_bets_for_parse(DATE, UUID, UUID, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.get_grouped_bets_for_parse(
  p_date DATE,
  p_schedule_id UUID DEFAULT NULL,
  p_cashier_id UUID DEFAULT NULL,
  p_lottery_id UUID DEFAULT NULL,
  p_winners_only BOOLEAN DEFAULT FALSE,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  bet_id UUID,
  bet_type bet_type_enum,
  ticket_id UUID,
  user_id UUID,
  number TEXT,
  amount NUMERIC,
  place place_type_enum,
  "with" TEXT,
  "position" place_type_enum,
  date DATE,
  winner BOOLEAN,
  paid BOOLEAN,
  lottery_id UUID,
  schedule_id UUID,
  created_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  prize NUMERIC,
  ticket_number TEXT,
  cashier_name TEXT,
  hits INTEGER,
  lotteries JSONB,
  schedules JSONB
)
LANGUAGE sql
AS $$
  SELECT
    NULL::uuid AS bet_id,
    b.bet_type AS bet_type,
    NULL::uuid AS ticket_id,
    NULL::uuid AS user_id,
    b.number AS number,
    SUM(b.amount)::NUMERIC AS amount,
    b.place AS place,
    CASE WHEN b.bet_type = 'REDOUBLE' THEN b."with" ELSE NULL END AS "with",
    CASE WHEN b.bet_type = 'REDOUBLE' THEN b.position ELSE NULL END AS "position",
    b.date AS date,
    false AS winner,
    false AS paid,
    b.lottery_id AS lottery_id,
    b.schedule_id AS schedule_id,
    NULL::timestamptz AS created_at,
    NULL::timestamptz AS edited_at,
    NULL::timestamptz AS deleted_at,
    SUM(COALESCE(b.prize,0))::NUMERIC AS prize,
    ''::TEXT AS ticket_number,
    ''::TEXT AS cashier_name,
    SUM(COALESCE(b.hits,0))::INT AS hits,
    (SELECT to_jsonb(l2) FROM public.lotteries l2 WHERE l2.lottery_id = b.lottery_id AND (p_organization_id IS NULL OR l2.organization_id = p_organization_id)) AS lotteries,
    (SELECT to_jsonb(s2) FROM public.schedules s2 WHERE s2.schedule_id = b.schedule_id AND (p_organization_id IS NULL OR s2.organization_id = p_organization_id)) AS schedules
  FROM public.bets b
  WHERE b.date = p_date
    AND (p_schedule_id IS NULL OR b.schedule_id = p_schedule_id)
    AND (p_cashier_id IS NULL OR b.user_id = p_cashier_id)
    AND (p_lottery_id IS NULL OR b.lottery_id = p_lottery_id)
    AND (NOT p_winners_only OR b.winner IS TRUE)
    AND b.deleted_at IS NULL
    AND (p_organization_id IS NULL OR b.organization_id = p_organization_id)
  GROUP BY
    b.number, b.lottery_id, b.schedule_id, b.date, b.bet_type, b.place,
    CASE WHEN b.bet_type='REDOUBLE' THEN b."with" ELSE NULL END,
    CASE WHEN b.bet_type='REDOUBLE' THEN b.position ELSE NULL END
  ORDER BY SUM(b.amount) DESC, b.number;
$$;

-- ============================================================================
-- 10. bets_total_amount
-- ============================================================================
DROP FUNCTION IF EXISTS public.bets_total_amount(DATE, UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.bets_total_amount(
  p_date DATE,
  p_schedule_id UUID DEFAULT NULL,
  p_cashier_id UUID DEFAULT NULL,
  p_lottery_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_total NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(b.amount), 0)
  INTO v_total
  FROM public.bets b
  WHERE b.date = p_date
    AND b.deleted_at IS NULL
    AND (p_schedule_id IS NULL OR b.schedule_id = p_schedule_id)
    AND (p_cashier_id IS NULL OR b.user_id = p_cashier_id)
    AND (p_lottery_id IS NULL OR b.lottery_id = p_lottery_id)
    AND (p_organization_id IS NULL OR b.organization_id = p_organization_id);

  RETURN v_total;
END;
$$;

-- ============================================================================
-- 11. bets_total_prize
-- ============================================================================
DROP FUNCTION IF EXISTS public.bets_total_prize(DATE, UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.bets_total_prize(
  p_date DATE,
  p_schedule_id UUID DEFAULT NULL,
  p_cashier_id UUID DEFAULT NULL,
  p_lottery_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prize INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(b.prize), 0)
  INTO v_prize
  FROM public.bets b
  WHERE b.date = p_date
    AND b.deleted_at IS NULL
    AND b.winner IS TRUE
    AND (p_schedule_id IS NULL OR b.schedule_id = p_schedule_id)
    AND (p_cashier_id IS NULL OR b.user_id = p_cashier_id)
    AND (p_lottery_id IS NULL OR b.lottery_id = p_lottery_id)
    AND (p_organization_id IS NULL OR b.organization_id = p_organization_id);

  RETURN v_prize;
END;
$$;

-- ============================================================================
-- 12. get_ticket_sums
-- ============================================================================
DROP FUNCTION IF EXISTS get_ticket_sums(TEXT);

CREATE OR REPLACE FUNCTION get_ticket_sums(
  p_ticket TEXT,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE(total_amount NUMERIC, total_prize NUMERIC)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(amount), 0) AS total_amount,
    COALESCE(SUM(prize), 0) AS total_prize
  FROM bets
  WHERE ticket_number = p_ticket
    AND deleted_at IS NULL
    AND (p_organization_id IS NULL OR organization_id = p_organization_id);
$$;

-- ============================================================================
-- 13. update_active_lotteries
-- ============================================================================
DROP FUNCTION IF EXISTS update_active_lotteries(UUID[]);

CREATE OR REPLACE FUNCTION update_active_lotteries(
  lottery_ids UUID[],
  p_organization_id UUID
)
RETURNS VOID
AS $$
BEGIN
  -- Activar
  UPDATE lotteries
  SET active = TRUE,
      edited_at = NOW()
  WHERE lottery_id = ANY(lottery_ids)
    AND organization_id = p_organization_id
    AND active IS DISTINCT FROM TRUE;

  -- Desactivar
  UPDATE lotteries
  SET active = FALSE,
      edited_at = NOW()
  WHERE organization_id = p_organization_id
    AND NOT (lottery_id = ANY(lottery_ids))
    AND active IS DISTINCT FROM FALSE;
END;
$$ LANGUAGE plpgsql;
