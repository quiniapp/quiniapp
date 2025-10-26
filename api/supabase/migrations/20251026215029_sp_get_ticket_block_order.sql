create or replace function public.ticket_full_json_plpgsql(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_result jsonb;
begin
  with t as (
    select *
    from public.tickets
    where ticket_id = p_ticket_id
  ),
  br as (  -- base rows
    select
      b.ticket_id,
      b.number,
      b.amount,
      b.place,
      b."with",
      b.position,
      b.created_at       as bet_created_at,
      b.bet_order        as bet_order,              -- ✅ clave de bloque
      s.schedule_id,
      s."time"           as schedule_time,
      jsonb_build_object(
        'schedule_id', s.schedule_id,
        'name',        s.name,
        'time',        to_char(s."time", 'HH24:MI:SS')
      ) as schedule_obj,
      l.lottery_id,
      l.created_at       as lottery_created_at,
      jsonb_build_object(
        'lottery_id', l.lottery_id,
        'name',       l.name
      ) as lottery_obj
    from public.bets b
    join public.schedules s on s.schedule_id = b.schedule_id
    join public.lotteries l on l.lottery_id = b.lottery_id
    where b.ticket_id = p_ticket_id
  ),
  -- ✅ Deduplicación incluye bet_order para no fusionar bloques iguales
  br_dedup as (
    select distinct on (
      ticket_id, bet_order, number, amount, place, "with", position, schedule_id, lottery_id
    )
      ticket_id, number, amount, place, "with", position,
      schedule_id, schedule_time, schedule_obj,
      lottery_id, lottery_created_at, lottery_obj,
      bet_created_at,
      bet_order
    from br
    order by
      ticket_id, bet_order, number, amount, place, "with", position, schedule_id, lottery_id,
      lottery_created_at desc
  ),
  -- ✅ Por bet_order + bet + schedule => array de lotteries
  bet_sched as (
    select
      bet_order,                                   -- ✅
      number, amount, place, "with", position,
      schedule_id, schedule_obj, schedule_time,
      min(bet_created_at) as bet_created_at,
      jsonb_agg(lottery_obj order by lottery_created_at desc) as lotteries
    from br_dedup
    group by bet_order, number, amount, place, "with", position, schedule_id, schedule_obj, schedule_time
  ),
  -- ✅ Por bet_order + bet => scheduleLottery[]
  bets_grouped as (
    select
      bet_order,                                   -- ✅
      number, amount, place, "with", position,
      min(bet_created_at) as bet_created_at,
      jsonb_agg(
        jsonb_build_object(
          'schedule',  schedule_obj,
          'lotteries', lotteries
        )
        order by schedule_time asc
      ) as scheduleLottery
    from bet_sched
    group by bet_order, number, amount, place, "with", position
  ),
  -- JSON final de bets (ordenado por bet_order)
  bets_json as (
    select jsonb_agg(
      jsonb_build_object(
        'number',          number,
        'amount',          amount,
        'place',           place,
        'with',            "with",
        'position',        position,
        'scheduleLottery', scheduleLottery
      )
      order by bet_order asc                        -- ✅ clave: orden por bloque
    ) as bets
    from bets_grouped
  )
  select
    jsonb_build_object(
      'ticket_id',    t.ticket_id,
      'user_id',      t.user_id,
      'user_name',    t.user_name,
      'ticket_number',t.ticket_number,
      'date',         t.date,
      'paid',         t.paid,
      'winner',       t.winner,
      'total',        t.total,
      'total_prize',  t.total_prize,
      'created_at',   t.created_at,
      'deleted_at',   t.deleted_at,
      'deleted_by',   t.deleted_by,
      'hits',         t.hits,
      'bets',         coalesce(bj.bets, '[]'::jsonb)
    )
  into v_result
  from t
  cross join bets_json bj;

  return v_result;
end;
$$;

