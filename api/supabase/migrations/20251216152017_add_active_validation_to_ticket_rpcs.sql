-- ============================================================================
-- Migration: Add Active Status Validation to Ticket RPCs
-- ============================================================================
-- This migration adds validation to ensure that only active schedules and
-- lotteries can be used when creating or editing tickets.
-- ============================================================================

-- ============================================================================
-- 1. Create validation function for active schedules and lotteries
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_active_schedules_lotteries(
  p_schedule_ids UUID[],
  p_lottery_ids UUID[],
  p_organization_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_inactive_schedules TEXT[];
  v_inactive_lotteries TEXT[];
BEGIN
  -- Check for inactive schedules
  SELECT ARRAY_AGG(s.name) INTO v_inactive_schedules
  FROM schedules s
  WHERE s.schedule_id = ANY(p_schedule_ids)
    AND s.organization_id = p_organization_id
    AND s.active = false;

  IF array_length(v_inactive_schedules, 1) > 0 THEN
    RAISE EXCEPTION 'Cannot process ticket: Schedule(s) % are inactive',
      array_to_string(v_inactive_schedules, ', ')
    USING errcode = 'P0001';
  END IF;

  -- Check for inactive lotteries
  SELECT ARRAY_AGG(l.name) INTO v_inactive_lotteries
  FROM lotteries l
  WHERE l.lottery_id = ANY(p_lottery_ids)
    AND l.organization_id = p_organization_id
    AND l.active = false;

  IF array_length(v_inactive_lotteries, 1) > 0 THEN
    RAISE EXCEPTION 'Cannot process ticket: Lottery(s) % are inactive',
      array_to_string(v_inactive_lotteries, ', ')
    USING errcode = 'P0001';
  END IF;
END;
$$;

-- ============================================================================
-- 2. Update create_ticket_with_bets to validate active status
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_ticket_with_bets(jsonb, UUID);

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
  v_schedule_ids UUID[];
  v_lottery_ids UUID[];
BEGIN
  -- 0a) Extract unique schedule_ids and lottery_ids from the ticket JSON
  WITH bets AS (
    SELECT b
    FROM jsonb_array_elements(ticket->'bets') AS b
  ),
  schedule_lottery_items AS (
    SELECT
      (sl->>'schedule')::uuid AS schedule_id,
      lot_id::uuid AS lottery_id
    FROM bets
    CROSS JOIN LATERAL jsonb_array_elements(b->'scheduleLottery') AS sl
    CROSS JOIN LATERAL jsonb_array_elements_text(sl->'lotteries') AS lot(lot_id)
  )
  SELECT
    ARRAY_AGG(DISTINCT schedule_id),
    ARRAY_AGG(DISTINCT lottery_id)
  INTO v_schedule_ids, v_lottery_ids
  FROM schedule_lottery_items;

  -- 0b) Validate that all schedules and lotteries are active
  IF v_schedule_ids IS NOT NULL AND v_lottery_ids IS NOT NULL THEN
    PERFORM validate_active_schedules_lotteries(v_schedule_ids, v_lottery_ids, p_organization_id);
  END IF;

  -- 0c) Calcular total = suma(amount * cantidad_de_combinaciones)
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
-- 3. Update edit_ticket_replace_bets to validate active status
-- ============================================================================
DROP FUNCTION IF EXISTS public.edit_ticket_replace_bets(UUID, jsonb, UUID);

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
  v_schedule_ids UUID[];
  v_lottery_ids UUID[];
BEGIN
  -- 0a) Extract unique schedule_ids and lottery_ids from the bets JSON
  WITH bets AS (
    SELECT b
    FROM jsonb_array_elements(p_bets) AS b
  ),
  schedule_lottery_items AS (
    SELECT
      (sl->>'schedule')::uuid AS schedule_id,
      lot_id::uuid AS lottery_id
    FROM bets
    CROSS JOIN LATERAL jsonb_array_elements(b->'scheduleLottery') AS sl
    CROSS JOIN LATERAL jsonb_array_elements_text(sl->'lotteries') AS lot(lot_id)
  )
  SELECT
    ARRAY_AGG(DISTINCT schedule_id),
    ARRAY_AGG(DISTINCT lottery_id)
  INTO v_schedule_ids, v_lottery_ids
  FROM schedule_lottery_items;

  -- 0b) Validate that all schedules and lotteries are active
  IF v_schedule_ids IS NOT NULL AND v_lottery_ids IS NOT NULL THEN
    PERFORM validate_active_schedules_lotteries(v_schedule_ids, v_lottery_ids, p_organization_id);
  END IF;

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
