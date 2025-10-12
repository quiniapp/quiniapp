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

      -- schedule info
      s.schedule_id,
      s."time"                                        as schedule_time,
      jsonb_build_object(
        'schedule_id', s.schedule_id,
        'name',        s.name,
        -- devolvemos el time; si preferís crudo, podés usar s."time" directo
        'time',        s."time"
      ) as schedule_obj,

      -- lottery info
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
  -- por bet-identity + schedule => lotto array (orden: created_at DESC)
  bet_sched as (
    select
      number, amount, place, "with", position,
      schedule_id, schedule_obj, schedule_time,
      jsonb_agg(distinct lottery_obj order by lottery_created_at desc) as lotteries
    from br
    group by number, amount, place, "with", position, schedule_id, schedule_obj, schedule_time
  ),
  -- por bet-identity => scheduleLottery[] (orden: schedule_time ASC)
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
