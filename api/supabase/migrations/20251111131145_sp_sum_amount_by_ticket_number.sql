create or replace function get_ticket_sums(p_ticket text)
returns table(total_amount numeric, total_prize numeric)
language sql stable as $$
  select
    coalesce(sum(amount), 0) as total_amount,
    coalesce(sum(prize), 0)  as total_prize
  from bets
  where ticket_number = p_ticket
    and deleted_at is null;
$$;
