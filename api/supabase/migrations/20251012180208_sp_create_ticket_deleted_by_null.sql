create or replace function public.create_ticket_with_bets(ticket jsonb)
returns jsonb
language plpgsql
security definer
volatile
as $$
declare
  v_ticket_id uuid;
  v_now timestamptz := now();
  v_total numeric := 0;
begin
  -- 0) Calcular total = suma(amount * cantidad_de_combinaciones)
  --    cantidad_de_combinaciones = sumatoria de |lotteries| por cada schedule de cada bet
  with bets as (
    select b
    from jsonb_array_elements(ticket->'bets') as b
  ),
  combos as (
    select
      (b.b->>'amount')::numeric                         as amount,
      coalesce(sum(jsonb_array_length(sl->'lotteries')), 0) as combos_count
    from bets b
    left join lateral jsonb_array_elements(b.b->'scheduleLottery') as sl on true
    group by b.b
  )
  select coalesce(sum(amount * combos_count), 0) into v_total
  from combos;

  -- 1) Insertar ticket (cabecera) usando v_total
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
    false,
    false,
    v_total,            -- 🔹 total calculado en DB
    0,
    coalesce((ticket->>'created_at')::timestamptz, v_now),
    null,
    null,
    0
  )
  returning ticket_id into v_ticket_id;

  -- 2) Expandir y hacer bulk insert de bets (igual que antes)
  with raw_bets as (
    select
      v_ticket_id                      as ticket_id,
      (ticket->>'user_id')::uuid       as user_id,
      ticket->>'user_name'             as user_name,
      (ticket->>'ticket_number')       as ticket_number,
      (ticket->>'date')::date          as date,
      b->>'number'                     as number,
      (b->>'amount')::numeric          as amount,
      (b->>'place')::place_type_enum   as place,
      nullif(b->>'with','')            as "with",
      nullif(b->>'position','')::place_type_enum as position,
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
    bet_id, bet_type, ticket_id, user_id, number, amount, place, "with", position,
    date, winner, paid, lottery_id, schedule_id, ticket_number, cashier_name, hits, created_at
  )
  select
    bet_id, bet_type, ticket_id, user_id, number, amount, place, "with", position,
    date, winner, paid, lottery_id, schedule_id, ticket_number, cashier_name, hits, created_at
  from prepared;

  -- 3) Retornar hidratado
  return public.ticket_full_json_plpgsql(v_ticket_id);
exception
  when others then
    raise;
end;
$$;
