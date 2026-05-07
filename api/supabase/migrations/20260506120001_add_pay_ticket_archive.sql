-- ============================================================================
-- Migration: Add pay_ticket_archive function
-- ============================================================================
-- Allows paying winner tickets that have been moved to tickets_archive /
-- bets_archive (older than the active-days retention window).
-- Called as fallback by the repository when pay_ticket raises TICKET_NOT_FOUND.
-- ============================================================================

CREATE OR REPLACE FUNCTION pay_ticket_archive(
  p_ticket_number TEXT,
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_id UUID;
  v_ticket_user_id UUID;
  v_ticket_paid BOOLEAN;
  v_bets_updated INTEGER;
  v_current_timestamp TIMESTAMPTZ;
BEGIN
  v_current_timestamp := NOW();

  SELECT ticket_id, user_id, paid
  INTO v_ticket_id, v_ticket_user_id, v_ticket_paid
  FROM tickets_archive
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

  IF v_ticket_paid = TRUE THEN
    RAISE EXCEPTION 'TICKET_ALREADY_PAID';
  END IF;

  UPDATE tickets_archive
  SET paid = TRUE
  WHERE ticket_id = v_ticket_id
    AND organization_id = p_organization_id;

  UPDATE bets_archive
  SET
    paid = TRUE,
    edited_at = v_current_timestamp
  WHERE ticket_id = v_ticket_id
    AND organization_id = p_organization_id
    AND winner = TRUE
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_bets_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'bets_updated', v_bets_updated
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;
