create or replace function update_active_lotteries(lottery_ids uuid[])
returns void as $$
begin
  -- Activar
  update lotteries
  set active = true,
      edited_at = now()
  where lottery_id = any(lottery_ids)
    and active is distinct from true;

  -- Desactivar
  update lotteries
  set active = false,
      edited_at = now()
  where lottery_id is not null
    and not (lottery_id = any(lottery_ids))
    and active is distinct from false;
end;
$$ language plpgsql;
