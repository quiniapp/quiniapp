create or replace function public.edit_ticket_replace_bets(
  p_ticket_id uuid,
  p_bets jsonb
) returns jsonb
language plpgsql
volatile
as $$
declare
  v_ticket_row   tickets%rowtype;
  v_now          timestamptz := now();
  v_total        numeric := 0;
  v_created_base timestamptz;        -- ✅ agregado
begin
  -- 1) Traer y bloquear el ticket
  select * into v_ticket_row
  from public.tickets
  where ticket_id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket % no existe', p_ticket_id using errcode = 'P0002';
  end if;

  v_created_base := v_ticket_row.created_at;  -- ✅ base de tiempo coherente con el ticket

  -- 2) Borrar todas las bets actuales del ticket
  delete from public.bets
  where ticket_id = p_ticket_id;

  -- 3) Recalcular total desde p_bets
  with bets AS (
    select b
    from jsonb_array_elements(p_bets) as b
  ),
  combos AS (
    select
      (b.b->>'amount')::numeric as amount,
      coalesce(sum(jsonb_array_length(sl->'lotteries')), 0) as combos_count
    from bets b
    left join lateral jsonb_array_elements(b.b->'scheduleLottery') as sl on true
    group by b.b
  )
  select coalesce(sum(amount * combos_count), 0) into v_total
  from combos;

  -- 4) Actualizar cabecera
  update public.tickets t
  set total       = v_total,
      paid        = false,
      winner      = false,
      hits        = 0,
      total_prize = 0
  where t.ticket_id = p_ticket_id;

  -- 5) Insertar nuevas bets preservando el orden de llegada
  with raw_bets as (
    -- 👇 ordinalidad de bets
    select
      p_ticket_id                                  as ticket_id,
      v_ticket_row.user_id                         as user_id,
      v_ticket_row.user_name                       as user_name,
      v_ticket_row.ticket_number                   as ticket_number,
      v_ticket_row.date                            as date,
      b->>'number'                                 as number,
      (b->>'amount')::numeric                      as amount,
      (b->>'place')::place_type_enum               as place,
      nullif(b->>'with','')                        as "with",
      nullif(b->>'position','')::place_type_enum   as position,
      (b->'scheduleLottery')::jsonb                as schedule_lottery,
      bet_idx                                      as bet_ord
    from jsonb_array_elements(p_bets) with ordinality as b(b, bet_idx)
  ),
  exploded as (
    -- 👇 ordinalidad de scheduleLottery
    select
      rb.*,
      sl->>'schedule'            as schedule_id_text,
      (sl->'lotteries')::jsonb   as lotteries_json,
      sched_idx                  as sched_ord
    from raw_bets rb
    cross join lateral jsonb_array_elements(rb.schedule_lottery) with ordinality as sl(sl, sched_idx)
  ),
  cartesian as (
    -- 👇 ordinalidad de lotteries
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
    -- 👇 secuencia estable
    select
      c.*,
      row_number() over (order by bet_ord, sched_ord, lot_ord) as rn
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
      rn                        as bet_order,     -- ✅ orden estable
      v_created_base            as created_at     -- ✅ mismo created_at que el ticket
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
  from prepared;

  -- 6) Devolver ticket hidratado
  return public.ticket_full_json_plpgsql(p_ticket_id);
end;
$$;
