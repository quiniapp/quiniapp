create or replace function public.create_ticket_with_bets(
  ticket jsonb,
  bets jsonb
) returns jsonb
language plpgsql
as $$
declare
  inserted_ticket jsonb;
  inserted_bets jsonb;
begin
  -- Insertar el ticket
  insert into tickets (
    ticket_id,
    user_id,
    user_name,
    ticket_number,
    date,
    paid,
    winner,
    total
  ) values (
    (ticket->>'ticket_id')::uuid,
    (ticket->>'user_id')::uuid,
    ticket->>'user_name',
    (ticket->>'ticket_number'),
    (ticket->>'date')::date,
    coalesce((ticket->>'paid')::boolean, false),
    coalesce((ticket->>'winner')::boolean, false),
    (ticket->>'total')::numeric
  )
  returning to_jsonb(tickets.*) into inserted_ticket;

  -- Insertar las apuestas asociadas al ticket
  with inserted as (
    insert into bets (
      bet_id,
      bet_type,
      ticket_id,
      user_id,
      number,
      amount,
      place,
      "with",
      position,
      date,
      winner,
      paid,
      lottery_id,
      schedule_id,
  ticket_number,
  cashier_name
    )
    select
      gen_random_uuid(),
      (bet->>'bet_type')::bet_type_enum,
      (inserted_ticket->>'ticket_id')::uuid,
      (bet->>'user_id')::uuid,
      bet->>'number',
      (bet->>'amount')::numeric,
      (bet->>'place')::place_type_enum,
      NULLIF(bet->>'with', ''),
      (bet->>'position')::place_type_enum,
      (bet->>'date')::date,
      coalesce((bet->>'winner')::boolean, false),
      coalesce((bet->>'paid')::boolean, false),
      (bet->>'lottery_id')::uuid,
      (bet->>'schedule_id')::uuid,
  (inserted_ticket->>'ticket_number'),
  inserted_ticket->>'user_name'   
    from jsonb_array_elements(bets) as bet
    returning *
  ),
  joined as (
    select
      b.*,
      to_jsonb(l) as lottery,
      to_jsonb(s) as schedule
    from inserted b
    left join lotteries l on b.lottery_id = l.lottery_id
    left join schedules s on b.schedule_id = s.schedule_id
  )
  select jsonb_agg(to_jsonb(joined.*)) into inserted_bets from joined;

  -- Devolver el ticket con bets embebidos
  return inserted_ticket || jsonb_build_object('bets', inserted_bets);
end;
$$;
