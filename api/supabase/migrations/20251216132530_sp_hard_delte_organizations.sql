drop function if exists public.soft_delete_organization(uuid);

create or replace function public.hard_delete_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- HIJAS (más dependientes primero)
  delete from public.ticket_prizes_by_turn
   where organization_id = p_org_id;

  delete from public.bets
   where organization_id = p_org_id;

  delete from public.tickets
   where organization_id = p_org_id;

  delete from public.current_accounts
   where organization_id = p_org_id;

  delete from public.results
   where organization_id = p_org_id;

  delete from public.schedule_lotteries
   where organization_id = p_org_id;

  delete from public.schedules
   where organization_id = p_org_id;

  delete from public.lotteries
   where organization_id = p_org_id;

  delete from public.users
   where organization_id = p_org_id;

  -- PADRE al final
  delete from public.organizations
   where id = p_org_id;
end;
$$;

revoke all on function public.hard_delete_organization(uuid) from public;
grant execute on function public.hard_delete_organization(uuid) to service_role;
