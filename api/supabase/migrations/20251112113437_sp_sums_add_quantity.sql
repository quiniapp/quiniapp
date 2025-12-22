  
drop function if exists public.get_ticket_sums(text);
  
  create or replace function get_ticket_sums(p_ticket       
  text)
  returns table(
    total_amount numeric,
    total_prize numeric,
    total_count bigint,
    total_winners_count bigint
  )
  language sql stable as $$
    select
      coalesce(sum(amount), 0) as total_amount,
      coalesce(sum(prize), 0) as total_prize,
      count(*) as total_count,
      count(*) filter (where winner = true) as
  total_winners_count
    from bets
    where ticket_number = p_ticket
      and deleted_at is null;
  $$;