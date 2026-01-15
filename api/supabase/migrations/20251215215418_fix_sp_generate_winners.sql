
DROP FUNCTION IF EXISTS generate_winners_and_calculate_accounts(UUID, DATE, UUID);

CREATE OR REPLACE FUNCTION generate_winners_and_calculate_accounts(
  p_schedule_id UUID,
  p_date DATE,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_winners_result JSONB;
  v_current_account_result JSONB[];
  v_date_text TEXT;
BEGIN
  -- 1. Generar ganadores (ahora con organization_id)
  v_winners_result := generate_winners(p_schedule_id, p_date, p_organization_id);


  -- 2. Calcular cuentas corrientes (ahora con organization_id)
  v_date_text := to_char(p_date, 'DD-MM-YYYY');
  v_current_account_result := calculate_current_account(v_date_text, false, false, p_organization_id);

  -- 3. Retornar resultado combinado
  RETURN jsonb_build_object(
    'success', true,
    'winners', v_winners_result,
    'accounts_updated', COALESCE(jsonb_array_length(to_jsonb(v_current_account_result)), 0),
    'schedule_id', p_schedule_id,
    'date', p_date
  );
END;
$$;


