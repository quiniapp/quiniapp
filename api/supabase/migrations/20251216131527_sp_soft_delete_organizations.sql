create or replace function soft_delete_organization(p_org_id uuid)
returns void
language plpgsql
as $$
declare
  v_ts timestamptz := now();
begin
  update ticket_prizes_by_turn
     set deleted_at = v_ts
   where organization_id = p_org_id
     and deleted_at is null;

  update bets
     set deleted_at = v_ts
   where organization_id = p_org_id
     and deleted_at is null;

  update tickets
     set deleted_at = v_ts
   where organization_id = p_org_id
     and deleted_at is null;

  update current_accounts
     set deleted_at = v_ts
   where organization_id = p_org_id
     and deleted_at is null;

  update results
     set deleted_at = v_ts
   where organization_id = p_org_id
     and deleted_at is null;

  update schedule_lotteries
     set deleted_at = v_ts
   where organization_id = p_org_id
     and deleted_at is null;

  update schedules
     set deleted_at = v_ts
   where organization_id = p_org_id
     and deleted_at is null;

  update lotteries
     set deleted_at = v_ts
   where organization_id = p_org_id
     and deleted_at is null;

  update users
     set deleted_at = v_ts
   where organization_id = p_org_id
     and deleted_at is null;

  update organizations
     set deleted_at = v_ts
   where id = p_org_id
     and deleted_at is null;
end;
$$;
