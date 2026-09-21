-- Engancha el procesamiento diario de Polla al flujo existente de generación de
-- ganadores, entre el cálculo de ganadores de quiniela normal y el cálculo de
-- cuentas corrientes del día — así el premio de Polla (si se determina hoy) queda
-- incluido en la misma liquidación diaria sin tocar ningún archivo TypeScript
-- (api/src/winners/repository/winners.repository.ts ya invoca este RPC).

DROP FUNCTION IF EXISTS generate_winners_and_calculate_accounts(UUID, DATE, UUID);

CREATE OR REPLACE FUNCTION generate_winners_and_calculate_accounts(
  p_schedule_id UUID,
  p_date DATE,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_winners_result JSONB;
  v_polla_result JSONB;
  v_current_account_result JSONB[];
  v_date_text TEXT;
BEGIN
  -- 1. Generar ganadores de quiniela normal
  v_winners_result := generate_winners(p_schedule_id, p_date, p_organization_id);

  -- 2. Procesar aciertos de Polla para este schedule+date (si hay edición activa)
  v_polla_result := process_polla_editions_for_schedule_date(p_schedule_id, p_date, p_organization_id);

  -- 3. Calcular cuentas corrientes (incluye pase/premio de quiniela normal y de Polla)
  v_date_text := to_char(p_date, 'DD-MM-YYYY');
  v_current_account_result := calculate_current_account(v_date_text, false, false, p_organization_id);

  -- 4. Retornar resultado combinado
  RETURN jsonb_build_object(
    'success', true,
    'winners', v_winners_result,
    'polla', v_polla_result,
    'accounts_updated', COALESCE(jsonb_array_length(to_jsonb(v_current_account_result)), 0),
    'schedule_id', p_schedule_id,
    'date', p_date
  );
END;
$$;
