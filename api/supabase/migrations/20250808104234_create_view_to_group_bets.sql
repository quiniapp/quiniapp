create or replace function public.get_grouped_bets_for_parse(
  p_date date,
  p_schedule_id uuid default null,
  p_cashier_id uuid default null,
  p_lottery_id uuid default null,
  p_winners_only boolean default false
)
returns table (
  bet_id uuid,
  bet_type bet_type_enum,
  ticket_id uuid,
  user_id uuid,
  number text,
  amount numeric,
  place place_type_enum,
  "with" text,
  "position" place_type_enum,
  date date,
  winner boolean,
  paid boolean,
  lottery_id uuid,
  schedule_id uuid,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  prize numeric,
  ticket_number text,
  cashier_name text,
  hits integer,
  lotteries jsonb,
  schedules jsonb
)
language sql
as $$
  select
    null::uuid                         as bet_id,
    b.bet_type                         as bet_type,
    null::uuid                         as ticket_id,
    null::uuid                         as user_id,
    b.number                           as number,
    sum(b.amount)::numeric             as amount,
    b.place                            as place,
    case when b.bet_type = 'REDOUBLE' then b."with" else null end         as "with",
    case when b.bet_type = 'REDOUBLE' then b.position else null end       as "position",
    b.date                             as date,
    false                              as winner,        -- agregado => false
    false                              as paid,          -- agregado => false
    b.lottery_id                       as lottery_id,
    b.schedule_id                      as schedule_id,
    null::timestamptz                  as created_at,
    null::timestamptz                  as edited_at,
    null::timestamptz                  as deleted_at,
    sum(coalesce(b.prize,0))::numeric  as prize,
    ''::text                           as ticket_number, -- el modelo lo define como text
    ''::text                           as cashier_name,
    sum(coalesce(b.hits,0))::int       as hits,

    -- include completo (todas las columnas) sin ensuciar el GROUP BY
    (select to_jsonb(l2) from public.lotteries l2 where l2.lottery_id = b.lottery_id)   as lotteries,
    (select to_jsonb(s2) from public.schedules s2 where s2.schedule_id = b.schedule_id) as schedules

  from public.bets b
  where b.date = p_date
    and (p_schedule_id is null or b.schedule_id = p_schedule_id)
    and (p_cashier_id  is null or b.user_id     = p_cashier_id)
    and (p_lottery_id  is null or b.lottery_id  = p_lottery_id)
    and (not p_winners_only or b.winner is true)
    and b.deleted_at is null

  group by
    b.number, b.lottery_id, b.schedule_id, b.date, b.bet_type, b.place,
    case when b.bet_type='REDOUBLE' then b."with"    else null end,
    case when b.bet_type='REDOUBLE' then b.position  else null end

  order by sum(b.amount) desc, b.number;
$$;
