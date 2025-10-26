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
  v_created_base timestamptz;
begin
  -- 0) Calcular total = suma(amount * cantidad_de_combinaciones)
  with bets as (
    select b
    from jsonb_array_elements(ticket->'bets') as b
  ),
  combos as (
    select
      (b.b->>'amount')::numeric                             as amount,
      coalesce(sum(jsonb_array_length(sl->'lotteries')),0) as combos_count
    from bets b
    left join lateral jsonb_array_elements(b.b->'scheduleLottery') as sl on true
    group by b.b
  )
  select coalesce(sum(amount * combos_count), 0) into v_total
  from combos;

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
    false,
    false,
    v_total,
    0,
    coalesce((ticket->>'created_at')::timestamptz, v_now),
    null,
    null,
    0
  )
  returning ticket_id, created_at into v_ticket_id, v_created_base;

  -- 2) Bulk insert de bets preservando orden por BLOQUE (ordinalidad del bet en el JSON)
  with raw_bets as (
    -- ordinalidad de bets (bet_ord = índice del array de entrada)
    select
      v_ticket_id                                as ticket_id,
      (ticket->>'user_id')::uuid                 as user_id,
      ticket->>'user_name'                       as user_name,
      (ticket->>'ticket_number')                 as ticket_number,
      (ticket->>'date')::date                    as date,
      b->>'number'                               as number,
      (b->>'amount')::numeric                    as amount,
      (b->>'place')::place_type_enum             as place,
      nullif(b->>'with','')                      as "with",
      nullif(b->>'position','')::place_type_enum as position,
      (b->'scheduleLottery')::jsonb              as schedule_lottery,
      bet_idx                                    as bet_ord
    from jsonb_array_elements(ticket->'bets') with ordinality as b(b, bet_idx)
  ),
  exploded as (
    -- ordinalidad de scheduleLottery
    select
      rb.*,
      sl->>'schedule'          as schedule_id_text,
      (sl->'lotteries')::jsonb as lotteries_json,
      sched_idx                as sched_ord
    from raw_bets rb
    cross join lateral jsonb_array_elements(rb.schedule_lottery) with ordinality as sl(sl, sched_idx)
  ),
  cartesian as (
    -- ordinalidad de lotteries
    select
      ticket_id, user_id, user_name, ticket_number, date,
      number, amount, place, "with", position,
      (schedule_id_text)::uuid  as schedule_id,
      (lot_el)::uuid            as lottery_id,
      bet_ord, sched_ord, lot_ord
    from exploded
    cross join lateral jsonb_array_elements_text(lotteries_json) with ordinality as lot(lot_el, lot_ord)
  ),
  numbered as (
    -- bet_group_order: orden por BLOQUE (igual al índice del bet de entrada)
    -- combo_rn: orden interno de combinaciones dentro del bloque (opcional)
    select
      c.*,
      bet_ord                                   as bet_group_order,
      row_number() over (
        partition by bet_ord
        order by sched_ord, lot_ord
      )                                         as combo_rn
    from cartesian c
  ),
  prepared as (
    select
      gen_random_uuid() as bet_id,
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
      ticket_id,
      user_id,
      number,
      amount,
      place,
      "with",
      position,
      date,
      false                     as winner,
      false                     as paid,
      lottery_id,
      schedule_id,
      ticket_number,
      user_name                 as cashier_name,
      0                         as hits,
      bet_group_order           as bet_order,     -- << orden por BLOQUE
      v_created_base            as created_at,
      combo_rn
    from numbered
  )
  insert into public.bets (
    bet_id, bet_type, ticket_id, user_id, number, amount, place, "with", position,
    date, winner, paid, lottery_id, schedule_id, ticket_number, cashier_name, hits,
    bet_order, created_at
  )
  select
    bet_id, bet_type, ticket_id, user_id, number, amount, place, "with", position,
    date, winner, paid, lottery_id, schedule_id, ticket_number, cashier_name, hits,
    bet_order, created_at
  from prepared
  order by bet_order, combo_rn;  -- opcional: escritura estable

  -- 3) Retornar hidratado
  return public.ticket_full_json_plpgsql(v_ticket_id);
exception
  when others then
    raise;
end;
$$;
