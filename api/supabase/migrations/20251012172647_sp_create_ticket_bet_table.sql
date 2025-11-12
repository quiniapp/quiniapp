-- 1) Elimina la versión vieja con 2 parámetros
drop function if exists public.create_ticket_with_bets(jsonb, jsonb);

-- 2) Nueva firma (un solo jsonb: ticket)
create or replace function public.create_ticket_with_bets(ticket jsonb)
returns jsonb
language plpgsql
security definer
volatile
as $$
declare
  v_ticket_id uuid;
  v_now timestamptz := now();
begin
  -- 1) Insertar ticket (cabecera)
  insert into public.tickets (
    ticket_id, user_id, user_name, ticket_number, date,
    paid, winner, total, total_prize,
    created_at, deleted_at, deleted_by, hits
  )
  values (
    (ticket->>'ticket_id')::uuid,
    nullif(ticket->>'user_id','')::uuid,
    ticket->>'user_name',
    ticket->>'ticket_number',
    (ticket->>'date')::date,
    coalesce((ticket->>'paid')::boolean, false),
    coalesce((ticket->>'winner')::boolean, false),
    coalesce((ticket->>'total')::numeric, 0),
    coalesce((ticket->>'total_prize')::numeric, 0),
    coalesce((ticket->>'created_at')::timestamptz, v_now),
    nullif(ticket->>'deleted_at','')::timestamptz,
    nullif(ticket->>'deleted_by',''),
    coalesce((ticket->>'hits')::int, 0)
  )
  returning ticket_id into v_ticket_id;

  -- 2) Expandir y hacer bulk insert de bets
  with raw_bets as (
    select
      v_ticket_id                      as ticket_id,
      (ticket->>'user_id')::uuid       as user_id,
      ticket->>'user_name'             as user_name,
      (ticket->>'ticket_number')       as ticket_number,
      (ticket->>'date')::date          as date,
      b->>'number'                     as number,
      (b->>'amount')::numeric          as amount,
      (b->>'place')::place_type_enum   as place,       -- ajustá el enum si difiere
      nullif(b->>'with','')            as "with",
      nullif(b->>'position','')::place_type_enum as position, -- puede ser null
      (b->'scheduleLottery')::jsonb    as schedule_lottery
    from jsonb_array_elements(ticket->'bets') as b
  ),
  exploded as (
    select
      rb.*,
      sl->>'schedule'            as schedule_id_text,
      (sl->'lotteries')::jsonb   as lotteries_json
    from raw_bets rb
    cross join lateral jsonb_array_elements(rb.schedule_lottery) as sl
  ),
  cartesian as (
    select
      ticket_id, user_id, user_name, ticket_number, date,
      number, amount, place, "with", position,
      (schedule_id_text)::uuid  as schedule_id,
      (lot_el)::uuid            as lottery_id
    from exploded
    cross join lateral jsonb_array_elements_text(lotteries_json) as lot_el
  ),
  prepared as (
    select
      gen_random_uuid()                        as bet_id,
      -- Derivar bet_type según reglas (ajustá nombres/valores del enum)
      (
        case
          when length(number) = 1 then 'ONE'
          when length(number) = 2 and coalesce(length("with"),0) = 0 then 'DOUBLE'
          when length(number) = 2 and coalesce(length("with"),0) = 2 then 'REDOUBLE'
          when length(number) = 3 then 'TERN'
          when length(number) = 4 then 'QUATERN'
          when length(number) = 10 then 'BORRATINA'
          else null
        end
      )::bet_type_enum          as bet_type,
      c.ticket_id,
      c.user_id,
      c.number,
      c.amount,
      c.place,
      c."with",
      c.position,
      c.date,
      /* flags y metadata de bet; si tu tabla tiene defaults podés omitirlos */
      false                     as winner,
      false                     as paid,
      c.lottery_id,
      c.schedule_id,
      c.ticket_number,
      c.user_name               as cashier_name,
      0                         as hits,
      v_now                     as created_at
    from cartesian c
  )
  insert into public.bets (
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
    cashier_name,
    hits,
    created_at
  )
  select
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
    cashier_name,
    hits,
    created_at
  from prepared;

  -- 3) Retornar el ticket hidratado (ITicketEntityBack)
  return public.ticket_full_json_plpgsql(v_ticket_id);
exception
  when others then
    raise;
end;
$$;
