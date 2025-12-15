
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
  v_accounts_result JSONB[];
  v_date_formatted TEXT;
BEGIN
  -- 1. Generar ganadores (ahora retorna JSONB, garantiza commit)
  v_winners_result := generate_winners(p_schedule_id, p_bet_date);

  -- 2. Formatear fecha para calculate_current_account (espera DD-MM-YYYY)
  v_date_formatted := to_char(p_bet_date, 'DD-MM-YYYY');

  -- 3. Calcular cuenta corriente (lee datos ya commiteados de generate_winners)
  v_accounts_result := calculate_current_account(
    v_date_formatted,
    false,  -- p_calculate_leave
    false   -- p_liquidated
  );

  -- 4. Retornar resultado combinado
  RETURN jsonb_build_object(
    'success', true,
    'winners', v_winners_result,
    'accounts_updated', COALESCE(jsonb_array_length(to_jsonb(v_accounts_result)), 0),
    'schedule_id', p_schedule_id,
    'date', p_bet_date
  );
END;
$$;

