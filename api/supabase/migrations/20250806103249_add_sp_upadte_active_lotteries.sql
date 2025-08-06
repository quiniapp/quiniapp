create or replace function update_active_lotteries(lottery_ids text[])
returns void as $$
begin
  -- Activar las que vienen por parámetro y están inactivas
  update lotteries
  set active = true,
      updated_at = now()
  where lottery_id = any(lottery_ids)
    and active is distinct from true;

  -- Desactivar las que no están en la lista y están activas
  update lotteries
  set active = false,
      updated_at = now()
  where lottery_id is not null
    and not (lottery_id = any(lottery_ids))
    and active is distinct from false;
end;
$$ language plpgsql;
