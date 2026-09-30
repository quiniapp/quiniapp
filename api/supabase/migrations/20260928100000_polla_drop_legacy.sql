-- Polla se separa de QuiniApp: pasa a ser un sistema propio con esquema polla_*,
-- usuarios/auth propios y su propio frontend. Esta migración desmonta la
-- integración anterior (tablas polla_editions/polla_bets acopladas a tickets,
-- y el hook dentro de generate_winners_and_calculate_accounts).
--
-- Los tickets que generó la Polla vieja quedan como están: ya se liquidaron.

-- 1. Restaurar generate_winners_and_calculate_accounts sin la rama de Polla
--    (vuelve al cuerpo previo al hook de 20260920100300).
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
  v_current_account_result JSONB[];
  v_date_text TEXT;
BEGIN
  -- 1. Generar ganadores
  v_winners_result := generate_winners(p_schedule_id, p_date, p_organization_id);

  -- 2. Calcular cuentas corrientes
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

ALTER FUNCTION generate_winners_and_calculate_accounts(UUID, DATE, UUID)
  SET statement_timeout = '300000';

-- 2. Funciones de la Polla vieja
DROP FUNCTION IF EXISTS create_polla_bet(UUID, UUID, TEXT, TEXT[], UUID, DATE);
DROP FUNCTION IF EXISTS process_polla_editions_for_schedule_date(UUID, DATE, UUID);
DROP FUNCTION IF EXISTS process_polla_edition_hits(UUID, UUID, DATE, UUID);
DROP FUNCTION IF EXISTS update_polla_bet_numbers(UUID, TEXT[], UUID);
DROP FUNCTION IF EXISTS delete_polla_bet(UUID, UUID, UUID);

-- 3. Tablas y tipos viejos (el trigger cae con la tabla; la función del trigger
--    se recrea con el mismo nombre en el esquema nuevo, así que se dropea acá).
DROP TABLE IF EXISTS polla_bets;
DROP TABLE IF EXISTS polla_editions;
DROP FUNCTION IF EXISTS validate_polla_bet_numbers_distinct();
DROP TYPE IF EXISTS polla_edition_status_enum;
