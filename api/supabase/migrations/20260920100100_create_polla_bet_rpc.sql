-- Crea una jugada de Polla: cada jugada (10 números) es un ticket independiente,
-- nunca se mezcla con jugadas de quiniela normal. Mismo formato de ticket_number
-- que ticketBase.ts (api/src/ticket/helper/ticketBase.ts): timestamp con milisegundos
-- + sufijo del número de pasador (o aleatorio si no aplica) para evitar colisiones
-- concurrentes, cumpliendo el CHECK (ticket_number ~ '^\d+(-\d+)?$') de tickets.

CREATE OR REPLACE FUNCTION public.create_polla_bet(
  p_polla_edition_id UUID,
  p_user_id UUID,
  p_user_name TEXT,
  p_numbers TEXT[],
  p_organization_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions%ROWTYPE;
  v_ticket_id UUID := gen_random_uuid();
  v_polla_bet_id UUID;
  v_now TIMESTAMPTZ := now();
  v_user_number INTEGER;
  v_ticket_number TEXT;
BEGIN
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_polla_edition_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF v_edition.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_ACTIVE';
  END IF;

  IF p_date > v_edition.load_limit_date THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  IF array_length(p_numbers, 1) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_MUST_BE_TEN';
  END IF;

  SELECT number INTO v_user_number FROM users WHERE user_id = p_user_id;

  v_ticket_number := to_char(v_now AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYYMMDDHH24MISSMS')
    || '-' || COALESCE(v_user_number::text, floor(random() * 100000)::text);

  INSERT INTO public.tickets (
    ticket_id, user_id, user_name, ticket_number, date,
    paid, winner, total, total_prize,
    created_at, deleted_at, deleted_by, hits, organization_id, client_request_id
  ) VALUES (
    v_ticket_id, p_user_id, p_user_name, v_ticket_number, p_date,
    false, false, v_edition.ticket_price, 0,
    v_now, null, null, 0, p_organization_id, null
  );

  INSERT INTO public.polla_bets (
    polla_bet_id, ticket_id, polla_edition_id, organization_id,
    user_id, user_name, load_date, numbers, hit_numbers, hits,
    winner, prize, hit_date, created_at
  ) VALUES (
    gen_random_uuid(), v_ticket_id, p_polla_edition_id, p_organization_id,
    p_user_id, p_user_name, p_date, p_numbers, '{}', 0,
    false, 0, null, v_now
  )
  RETURNING polla_bet_id INTO v_polla_bet_id;

  RETURN jsonb_build_object(
    'polla_bet_id', v_polla_bet_id,
    'ticket_id', v_ticket_id,
    'ticket_number', v_ticket_number,
    'polla_edition_id', p_polla_edition_id,
    'user_id', p_user_id,
    'user_name', p_user_name,
    'load_date', p_date,
    'numbers', to_jsonb(p_numbers),
    'hit_numbers', '[]'::jsonb,
    'hits', 0,
    'winner', false,
    'prize', 0,
    'hit_date', null
  );
END;
$$;
