create or replace function public.edit_ticket_replace_bets(
  p_ticket_id uuid,
  p_bets jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_ticket_row   tickets%rowtype;
  v_ticket_json  jsonb;
  v_inserted_bets jsonb;
  v_total numeric;
begin
  -- 1) Traer y bloquear el ticket para edición
  select *
    into v_ticket_row
  from tickets
  where ticket_id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket % no existe', p_ticket_id using errcode = 'P0002';
  end if;

  -- 2) Borrar todas las bets asociadas al ticket
  delete from bets
  where ticket_id = p_ticket_id;

  -- 3) Recalcular total desde el JSON recibido
  select coalesce(sum( (bet->>'amount')::numeric ), 0)
    into v_total
  from jsonb_array_elements(p_bets) as bet;

  -- 4) Actualizar el ticket: total y resets solicitados
  update tickets t
     set total       = v_total,
         paid        = false,
         winner      = false,
         hits        = 0,
         total_prize = 0
   where t.ticket_id = p_ticket_id
   returning to_jsonb(t.*)
     into v_ticket_json;

  -- 5) Insertar nuevas bets desde p_bets
  with inserted as (
    insert into bets (
      bet_id,
      bet_type,
      ticket_id,
      user_id,
      number,
      amount,
      place,
      "with",
      position,
      date,
      winner,
      paid,
      lottery_id,
      schedule_id,
      ticket_number,
      cashier_name
    )
    select
      gen_random_uuid(),
      (bet->>'bet_type')::bet_type_enum,
      p_ticket_id,
      (bet->>'user_id')::uuid,
      bet->>'number',
      (bet->>'amount')::numeric,
      (bet->>'place')::place_type_enum,
      nullif(bet->>'with',''),
      nullif(bet->>'position','')::place_type_enum,
      (bet->>'date')::date,
      false,
      false,
      (bet->>'lottery_id')::uuid,
      (bet->>'schedule_id')::uuid,
      v_ticket_row.ticket_number,
      -- si no viene cashier_name en la bet, uso el user_name del ticket como fallback
      coalesce(bet->>'cashier_name', v_ticket_row.user_name)
    from jsonb_array_elements(p_bets) as bet
    returning *
  ),
  joined as (
    select
      b.*,
      to_jsonb(l) as lottery,
      to_jsonb(s) as schedule
    from inserted b
    left join lotteries l on l.lottery_id = b.lottery_id
    left join schedules s on s.schedule_id = b.schedule_id
  )
  select coalesce(jsonb_agg(to_jsonb(joined.*)), '[]'::jsonb)
    into v_inserted_bets
  from joined;

  -- 6) Devolver ticket + bets embebidas
  return v_ticket_json || jsonb_build_object('bets', v_inserted_bets);
end;
$$;
