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
  -- Obtener timestamp actual
  v_current_timestamp := NOW();

  -- 1. Verificar que el ticket existe y obtener sus datos
  SELECT ticket_id, user_id, paid
  INTO v_ticket_id, v_ticket_user_id, v_ticket_paid
  FROM tickets
  WHERE ticket_number = p_ticket_number
    AND paid = FALSE
    AND winner = TRUE
    AND deleted_at IS NULL;

  -- Validar que el ticket existe
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

  -- 4. Actualizar el ticket como pagado
  UPDATE tickets
  SET
    paid = TRUE,
    edited_at = v_current_timestamp
  WHERE ticket_id = v_ticket_id;

  -- 5. Actualizar todas las bets ganadoras del ticket como pagadas
  UPDATE bets
  SET
    paid = TRUE,
    edited_at = v_current_timestamp
  WHERE ticket_id = v_ticket_id
    AND winner = TRUE
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  -- Obtener cantidad de bets actualizadas
  GET DIAGNOSTICS v_bets_updated = ROW_COUNT;

  -- 6. Retornar resultado simple
  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'bets_updated', v_bets_updated
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Re-lanzar el error para que sea manejado por el cliente
    RAISE;
END;
$$;
