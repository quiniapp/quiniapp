-- Migration: Add SELECT FOR UPDATE to pay_ticket to serialize concurrent payment attempts
-- Date: 2026-04-19

CREATE OR REPLACE FUNCTION pay_ticket(
  p_ticket_number TEXT,
  p_user_id UUID
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

  -- 1. Lock the row before reading to serialize concurrent payment attempts
  SELECT ticket_id, user_id, paid
  INTO v_ticket_id, v_ticket_user_id, v_ticket_paid
  FROM tickets
  WHERE ticket_number = p_ticket_number
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

  UPDATE tickets
  SET paid = TRUE
  WHERE ticket_id = v_ticket_id;

  UPDATE bets
  SET
    paid = TRUE,
    edited_at = v_current_timestamp
  WHERE ticket_id = v_ticket_id
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
