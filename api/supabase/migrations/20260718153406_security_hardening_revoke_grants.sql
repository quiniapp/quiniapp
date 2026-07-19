-- Security hardening (schema audit 2026-07-18)
-- Context: the API accesses the database exclusively with the service_role key
-- (api/database/db.connection.ts). No client ever uses the anon/authenticated
-- roles, so every grant to those roles is unnecessary attack surface via the
-- auto-generated Data API (PostgREST).
--
-- 1. Enable RLS on tables that were missing it (org_expenses, analytics_*)
-- 2. Drop legacy/dangerous functions (process_bets, pay_ticket 2-arg)
-- 3. Fix concurrency bug: pay_ticket(text, uuid, uuid) was missing FOR UPDATE
-- 4. Pin search_path on SECURITY DEFINER function that lacked it
-- 5. Revoke all privileges from anon/authenticated (+ EXECUTE from PUBLIC)
--    and reset default privileges so future objects are not auto-granted

------------------------------------------------------------------------------
-- 1) RLS on tables that were missing it
--    service_role bypasses RLS, so the API is unaffected.
------------------------------------------------------------------------------
ALTER TABLE public.org_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_client_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_device_stats ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------------------
-- 2) Drop legacy functions
------------------------------------------------------------------------------
-- Legacy winners calculation: no organization awareness, wrong loop bounds for
-- place = TWENTY (iterated 1..10 instead of 1..20) and REDOUBLE multipliers
-- inconsistent with calculate_redouble_payout. Superseded by generate_winners.
DROP FUNCTION IF EXISTS public.process_bets();

-- Legacy pay_ticket without organization filter: ticket_number is only unique
-- per organization, so this version could pay a ticket of another org.
-- Superseded by pay_ticket(text, uuid, uuid).
DROP FUNCTION IF EXISTS public.pay_ticket(text, uuid);

------------------------------------------------------------------------------
-- 3) pay_ticket(text, uuid, uuid): add FOR UPDATE to serialize concurrent
--    payment attempts (the 2-arg legacy version had it; this one lost it).
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_ticket(
  p_ticket_number text,
  p_user_id uuid,
  p_organization_id uuid
) RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
DECLARE
  v_ticket_id UUID;
  v_ticket_user_id UUID;
  v_ticket_paid BOOLEAN;
  v_bets_updated INTEGER;
  v_current_timestamp TIMESTAMPTZ;
BEGIN
  v_current_timestamp := NOW();

  -- 1. Lock the row before reading to serialize concurrent payment attempts
  SELECT ticket_id, user_id, paid
  INTO v_ticket_id, v_ticket_user_id, v_ticket_paid
  FROM tickets
  WHERE ticket_number = p_ticket_number
    AND organization_id = p_organization_id
    AND winner = TRUE
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  IF v_ticket_user_id != p_user_id THEN
    RAISE EXCEPTION 'TICKET_NOT_OWNED';
  END IF;

  -- 2. Validar que el ticket no está ya pagado
  IF v_ticket_paid = TRUE THEN
    RAISE EXCEPTION 'TICKET_ALREADY_PAID';
  END IF;

  -- 3. Actualizar el ticket como pagado
  UPDATE tickets
  SET paid = TRUE
  WHERE ticket_id = v_ticket_id
    AND organization_id = p_organization_id;

  -- 4. Actualizar todas las bets ganadoras del ticket como pagadas
  UPDATE bets
  SET paid = TRUE,
      edited_at = v_current_timestamp
  WHERE ticket_id = v_ticket_id
    AND organization_id = p_organization_id
    AND winner = TRUE
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_bets_updated = ROW_COUNT;

  -- 5. Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'bets_updated', v_bets_updated
  );
END;
$$;

------------------------------------------------------------------------------
-- 4) SECURITY DEFINER without pinned search_path (search-path hijack risk)
------------------------------------------------------------------------------
ALTER FUNCTION public.create_ticket_with_bets(jsonb, uuid, uuid)
  SET search_path = 'public';

------------------------------------------------------------------------------
-- 5) Revoke privileges from anon / authenticated / PUBLIC
--    postgres and service_role keep their explicit grants.
------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Postgres grants EXECUTE on functions to PUBLIC by default; anon and
-- authenticated inherit it even after the revokes above. Remove it so
-- SECURITY DEFINER functions (e.g. hard_delete_organization) are not
-- callable through the Data API with the anon key.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Reset default privileges so FUTURE tables/functions/sequences are not
-- auto-granted to anon/authenticated (previous config granted ALL).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
