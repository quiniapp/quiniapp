-- Suma de montos (con/sin winners)
create or replace function public.bets_total_amount(
  p_date date,
  p_schedule_id uuid default null,
  p_cashier_id uuid default null,
  p_lottery_id uuid default null
)
returns numeric
language plpgsql
as $$
declare
  v_total numeric := 0;
begin
  select coalesce(sum(b.amount), 0)
  into v_total
  from public.bets b
  where b.date = p_date
    and b.deleted_at is null
    and (p_schedule_id is null or b.schedule_id = p_schedule_id)
    and (p_cashier_id  is null or b.user_id     = p_cashier_id)
    and (p_lottery_id  is null or b.lottery_id  = p_lottery_id);

  return v_total;
end;
$$;

-- Cantidad de aciertos (winners = true)
create or replace function public.bets_total_prize(
  p_date date,
  p_schedule_id uuid default null,
  p_cashier_id uuid default null,
  p_lottery_id uuid default null
)
returns integer
language plpgsql
as $$
declare
  v_prize integer := 0;
begin
  select coalesce(sum(b.prize), 0)
  into v_prize
  from public.bets b
  where b.date = p_date
    and b.deleted_at is null
    and b.winner is true
    and (p_schedule_id is null or b.schedule_id = p_schedule_id)
    and (p_cashier_id  is null or b.user_id     = p_cashier_id)
    and (p_lottery_id  is null or b.lottery_id  = p_lottery_id);

  return v_prize;
end;
$$;
