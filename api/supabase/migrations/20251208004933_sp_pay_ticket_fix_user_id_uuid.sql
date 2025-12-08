DROP FUNCTION IF EXISTS pay_ticket(TEXT,TEXT);

CREATE OR REPLACE FUNCTION pay_ticket(
  p_ticket_number TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_id TEXT;
  v_ticket_user_id UUID;
  v_ticket_paid BOOLEAN;
  v_updated_count INTEGER;
  v_result JSONB;
  v_current_timestamp TIMESTAMPTZ;
BEGIN
  -- Obtener timestamp actual
  v_current_timestamp := NOW();

  -- 1. Verificar que el ticket existe y obtener sus datos
  SELECT ticket_id, user_id, paid
  INTO v_ticket_id, v_ticket_user_id, v_ticket_paid
  FROM tickets
  WHERE ticket_number = p_ticket_number
    AND user_id = p_user_id
    AND paid = FALSE
    AND deleted_at IS NULL;

  -- Validar que el ticket existe
  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
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

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'Failed to update ticket';
  END IF;

  -- 5. Actualizar todas las bets ganadoras del ticket como pagadas
  UPDATE bets
  SET
    paid = TRUE,
    edited_at = v_current_timestamp
  WHERE ticket_id = v_ticket_id
    AND winner = TRUE
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  -- Nota: No validamos ROW_COUNT aquí porque es válido que un ticket
  -- no tenga bets ganadoras (todas perdedoras)

  -- 6. Obtener y retornar el ticket completo actualizado usando el RPC existente
  SELECT ticket_full_json_plpgsql(v_ticket_id)
  INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Re-lanzar el error para que sea manejado por el cliente
    RAISE;
END;
$$;
