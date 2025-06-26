create or replace function calculate_current_account(date text)
returns jsonb[]
language plpgsql
as $$
declare
  current_date date := to_date(date, 'DD-MM-YYYY');
  user_rec record;
    current_account_row jsonb;
  inserted_accounts jsonb[] := '{}';

  v_pass numeric(12,2);
  v_successes numeric(12,2);
  v_cashier_commission numeric(12,2);
  v_subtotal numeric(12,2);
  v_previous_balance numeric(12,2);
  v_collections numeric(12,2) := 0;
  v_paid numeric(12,2) := 0;
  v_bills numeric(12,2) := 0;
  v_revenue numeric(12,2);
  v_previous_drag numeric(12,2);
  v_drag numeric(12,2);
  v_total numeric(12,2);
  v_claims numeric(12,2) := 0;
  v_leave numeric(12,2) := 0;
  v_fee numeric(5,4);
begin
  -- Recorrer usuarios con tickets en esa fecha
  for user_rec in
    select 
      u.user_id,
      u.name,
      u.number,
      u.fee
    from users u
    where u.user_type = 'CASHIER' and exists (
      select 1
      from tickets t
      where t.user_id = u.user_id
        and t.date = current_date
        and t.deleted_at is null
    )
  loop
    -- Calcular pass y successes
    select 
      coalesce(sum(t.total), 0),
      coalesce(sum(t.total_prize), 0)
    into v_pass, v_successes
    from tickets t
    where t.user_id = user_rec.user_id
      and t.date = current_date
      and t.deleted_at is null;

    v_fee := user_rec.fee;
    v_cashier_commission := round(v_pass * v_fee, 2);
    v_revenue := v_pass - v_successes - v_cashier_commission;
    v_subtotal := v_revenue;

    -- Balance anterior (día anterior)
    select total, drag
    into v_previous_balance, v_previous_drag
    from current_accounts
    where user_id = user_rec.user_id
      and date = current_date - interval '1 day'
    order by date desc
    limit 1;

    if not found then
      v_previous_balance := 0;
      v_previous_drag := 0;
    end if;

    -- Regla especial: 1 de mes
    if extract(day from current_date) = 1 then
      if v_previous_drag >= 0 then
        v_previous_drag := 0;
        v_drag := v_revenue;
      else
        v_drag := v_previous_drag + v_revenue;
      end if;
    else
      v_drag := v_previous_drag + v_revenue;
    end if;

    -- Calcular total
    v_total := v_previous_balance + v_subtotal - v_collections + v_paid + v_bills;

    -- Insertar cuenta corriente
    insert into current_accounts (
      current_account_id,
      user_id,
      user_name,
      user_number,
      pass,
      successes,
      claims,
      subtotal,
      previous_balance,
      collections,
      paid,
      total,
      drag,
      leave,
      date,
      created_at,
      edited_at,
      cashier_commission,
      bills,
      revenue,
      previous_drag
    ) values (
      gen_random_uuid(),
      user_rec.user_id,
      user_rec.name,
      user_rec.number,
      v_pass,
      v_successes,
      v_claims,
      v_subtotal,
      v_previous_balance,
      v_collections,
      v_paid,
      v_total,
      v_drag,
      v_leave,
      current_date,
      now(),
      now(),
      v_cashier_commission,
      v_bills,
      v_revenue,
      v_previous_drag
    )
    returning to_jsonb(current_accounts.*) into current_account_row;

    inserted_accounts := array_append(inserted_accounts, current_account_row);
  end loop;
  
  return inserted_accounts;
end;
$$;
