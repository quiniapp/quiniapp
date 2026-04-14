-- Migration: Update create_ticket_with_bets to support idempotency key
DROP FUNCTION IF EXISTS public.create_ticket_with_bets(jsonb, UUID);
DROP FUNCTION IF EXISTS public.create_ticket_with_bets(jsonb, UUID, UUID);

CREATE OR REPLACE FUNCTION public.create_ticket_with_bets(
  ticket jsonb,
  p_organization_id UUID,
  p_client_request_id UUID DEFAULT NULL
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

  -- 1) Insertar ticket con idempotency key.
  --    ON CONFLICT targets only the client_request_id partial unique index.
  --    If the key already exists, DO NOTHING and v_ticket_id stays NULL.
  INSERT INTO public.tickets (
    ticket_id, user_id, user_name, ticket_number, date,
    paid, winner, total, total_prize,
    created_at, deleted_at, deleted_by, hits, organization_id,
    client_request_id
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
    p_organization_id,
    p_client_request_id
  )
  ON CONFLICT (client_request_id) WHERE client_request_id IS NOT NULL
  DO NOTHING
  RETURNING ticket_id, created_at INTO v_ticket_id, v_created_base;

  -- If v_ticket_id is NULL, the ON CONFLICT fired — ticket already exists.
  -- Fetch and return the existing ticket for idempotent response.
  IF v_ticket_id IS NULL AND p_client_request_id IS NOT NULL THEN
    SELECT ticket_id, created_at INTO v_ticket_id, v_created_base
    FROM public.tickets
    WHERE client_request_id = p_client_request_id
      AND organization_id = p_organization_id;

    IF FOUND THEN
      RETURN public.ticket_full_json_plpgsql(v_ticket_id, p_organization_id);
    END IF;
  END IF;

  -- 2) Bulk insert de bets preservando orden por BLOQUE
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

  -- 3) Retornar ticket hidratado
  RETURN public.ticket_full_json_plpgsql(v_ticket_id, p_organization_id);
END;
$$;
