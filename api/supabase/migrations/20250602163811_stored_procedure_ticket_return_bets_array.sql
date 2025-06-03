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
    ticket->>'ticket_number',
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
      schedule_id
    )
    select
      gen_random_uuid(),
      (bet->>'bet_type')::bet_type_enum,
      (inserted_ticket->>'ticket_id')::uuid,
      (bet->>'user_id')::uuid,
      bet->>'number',
      (bet->>'amount')::numeric,
      (bet->>'place')::place_type_enum,
      bet->>'with',
      (bet->>'position')::place_type_enum,
      (bet->>'date')::date,
      coalesce((bet->>'winner')::boolean, false),
      coalesce((bet->>'paid')::boolean, false),
      (bet->>'lottery_id')::uuid,
      (bet->>'schedule_id')::uuid
    from jsonb_array_elements(bets) as bet
    returning *
  )
  select jsonb_agg(to_jsonb(inserted.*)) into inserted_bets from inserted;

  -- Devolver el ticket con las apuestas
  return jsonb_build_object(
    'ticket', inserted_ticket,
    'bets', inserted_bets
  );
end;
$$;
