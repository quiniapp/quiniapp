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
    br as (
    select
      b.ticket_id,
      b.number,
      b.amount,
      b.place,
      b."with",
      b.position,

      s.schedule_id,
      s."time"                                        as schedule_time,
      jsonb_build_object(
        'schedule_id', s.schedule_id,
        'name',        s.name,
        'time',        to_char(s."time", 'HH24:MI:SS')
      ) as schedule_obj,

      l.lottery_id,
      l.created_at                                    as lottery_created_at,
      jsonb_build_object(
        'lottery_id', l.lottery_id,
        'name',       l.name
      ) as lottery_obj
    from public.bets b
    join public.schedules s on s.schedule_id = b.schedule_id
    join public.lotteries l on l.lottery_id = b.lottery_id
    where b.ticket_id = p_ticket_id
  ),

  -- 🔹 Deduplico por lottery_id (y por la identidad de la bet + schedule)
  br_dedup as (
    select distinct on (
      ticket_id, number, amount, place, "with", position, schedule_id, lottery_id
    )
      ticket_id, number, amount, place, "with", position,
      schedule_id, schedule_time, schedule_obj,
      lottery_id, lottery_created_at, lottery_obj
    from br
    order by
      ticket_id, number, amount, place, "with", position, schedule_id, lottery_id,
      lottery_created_at desc  -- si hubiera repetidos, me quedo con el más nuevo
  ),

  -- por bet-identity + schedule => lotto array (ordenadas por created_at DESC)
  bet_sched as (
    select
      number, amount, place, "with", position,
      schedule_id, schedule_obj, schedule_time,
      jsonb_agg(lottery_obj order by lottery_created_at desc) as lotteries
    from br_dedup
    group by number, amount, place, "with", position, schedule_id, schedule_obj, schedule_time
  ),

  -- por bet-identity => scheduleLottery[] (ordenadas por time ASC)
  bets_grouped as (
    select
      number, amount, place, "with", position,
      jsonb_agg(
        jsonb_build_object(
          'schedule',  schedule_obj,
          'lotteries', lotteries
        )
        order by schedule_time asc
      ) as scheduleLottery
    from bet_sched
    group by number, amount, place, "with", position
  ),

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
      order by number, amount
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
      'deleted_at',    t.deleted_at,
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
