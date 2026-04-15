-- Update hard_delete_organization: when a group is deleted,
-- set group_id = organization_id (not NULL) for affected users.
DROP FUNCTION IF EXISTS public.hard_delete_organization(uuid);

CREATE OR REPLACE FUNCTION public.hard_delete_organization(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Child tables first (most dependent)
  DELETE FROM public.ticket_prizes_by_turn
   WHERE organization_id = p_org_id;

  DELETE FROM public.bets
   WHERE organization_id = p_org_id;

  DELETE FROM public.tickets
   WHERE organization_id = p_org_id;

  DELETE FROM public.current_accounts
   WHERE organization_id = p_org_id;

  DELETE FROM public.results
   WHERE organization_id = p_org_id;

  DELETE FROM public.schedule_lotteries
   WHERE organization_id = p_org_id;

  DELETE FROM public.schedules
   WHERE organization_id = p_org_id;

  DELETE FROM public.lotteries
   WHERE organization_id = p_org_id;

  -- Users whose group was this org: reset group_id to their organization_id
  -- (convention: "no group" = group_id equals organization_id)
  UPDATE public.users
     SET group_id = organization_id, edited_at = now()
   WHERE group_id = p_org_id
     AND organization_id != p_org_id;

  -- Delete users whose organization_id IS this org (root org deletion)
  DELETE FROM public.users
   WHERE organization_id = p_org_id;

  -- Delete the organization itself
  DELETE FROM public.organizations
   WHERE organization_id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.hard_delete_organization(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.hard_delete_organization(uuid) TO service_role;
