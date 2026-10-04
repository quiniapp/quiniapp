-- Permite a admin/owner editar (cambiar números) o borrar una jugada de Polla,
-- siempre que la edición todavía no haya llegado a su fecha límite de carga —
-- igual que la edición/borrado de bets comunes, pero acotado a la ventana de carga
-- de Polla en vez de un límite de minutos.

ALTER TABLE polla_bets ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE polla_bets ADD COLUMN deleted_by UUID REFERENCES users(user_id);

DROP INDEX IF EXISTS idx_polla_bets_edition_pending;
CREATE INDEX idx_polla_bets_edition_pending ON polla_bets (polla_edition_id)
  WHERE winner = FALSE AND deleted_at IS NULL;

-- Refresco de process_polla_edition_hits: ignorar jugadas borradas al acumular
-- aciertos y al determinar ganadores.
CREATE OR REPLACE FUNCTION public.process_polla_edition_hits(
  p_lottery_id UUID,
  p_schedule_id UUID,
  p_date DATE,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions%ROWTYPE;
  v_results TEXT[];
  v_today_numbers TEXT[];
  v_winner_count INTEGER := 0;
  v_prize_per_winner NUMERIC(12,2) := 0;
  v_winner RECORD;
  v_premio_ticket_id UUID;
  v_premio_ticket_number TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE lottery_id = p_lottery_id
    AND schedule_id = p_schedule_id
    AND organization_id = p_organization_id
    AND status = 'ACTIVE'
    AND p_date BETWEEN start_date AND end_date
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT r.results INTO v_results
  FROM results r
  WHERE r.lottery_id = p_lottery_id
    AND r.schedule_id = p_schedule_id
    AND r.date = p_date
    AND r.organization_id = p_organization_id
    AND r.deleted_at IS NULL
  LIMIT 1;

  IF v_results IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ARRAY_AGG(DISTINCT RIGHT(val, 2)) INTO v_today_numbers
  FROM unnest(v_results) AS val;

  WITH computed AS (
    SELECT
      pb.polla_bet_id,
      COALESCE(
        (
          SELECT ARRAY_AGG(DISTINCT n)
          FROM unnest(
            pb.hit_numbers || ARRAY(SELECT n FROM unnest(pb.numbers) n WHERE n = ANY(v_today_numbers))
          ) n
        ),
        '{}'::text[]
      ) AS new_hit_numbers
    FROM polla_bets pb
    WHERE pb.polla_edition_id = v_edition.polla_edition_id
      AND pb.winner = FALSE
      AND pb.deleted_at IS NULL
  )
  UPDATE polla_bets pb
  SET hit_numbers = computed.new_hit_numbers,
      hits = COALESCE(array_length(computed.new_hit_numbers, 1), 0)
  FROM computed
  WHERE pb.polla_bet_id = computed.polla_bet_id;

  SELECT COUNT(*) INTO v_winner_count
  FROM polla_bets
  WHERE polla_edition_id = v_edition.polla_edition_id
    AND winner = FALSE
    AND deleted_at IS NULL
    AND hits = 10;

  IF v_winner_count > 0 THEN
    v_prize_per_winner := ROUND(v_edition.pool_amount / v_winner_count, 2);

    FOR v_winner IN
      SELECT polla_bet_id, user_id, user_name
      FROM polla_bets
      WHERE polla_edition_id = v_edition.polla_edition_id
        AND winner = FALSE
        AND deleted_at IS NULL
        AND hits = 10
    LOOP
      UPDATE polla_bets
      SET winner = TRUE, prize = v_prize_per_winner, hit_date = p_date
      WHERE polla_bet_id = v_winner.polla_bet_id;

      v_premio_ticket_id := gen_random_uuid();
      v_premio_ticket_number :=
        to_char(clock_timestamp() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYYMMDDHH24MISSMS')
        || '-' || floor(random() * 100000)::text;

      INSERT INTO public.tickets (
        ticket_id, user_id, user_name, ticket_number, date,
        paid, winner, total, total_prize,
        created_at, deleted_at, deleted_by, hits, organization_id, client_request_id
      ) VALUES (
        v_premio_ticket_id, v_winner.user_id, v_winner.user_name, v_premio_ticket_number, p_date,
        false, true, 0, v_prize_per_winner,
        v_now, null, null, 0, p_organization_id, null
      );
    END LOOP;

    UPDATE polla_editions
    SET status = 'FINISHED', winner_date = p_date, edited_at = v_now
    WHERE polla_edition_id = v_edition.polla_edition_id;
  ELSIF p_date = v_edition.end_date THEN
    UPDATE polla_editions
    SET status = 'FINISHED', winner_date = NULL, edited_at = v_now
    WHERE polla_edition_id = v_edition.polla_edition_id;
  END IF;

  RETURN jsonb_build_object(
    'polla_edition_id', v_edition.polla_edition_id,
    'winners', v_winner_count,
    'prize_per_winner', v_prize_per_winner,
    'finished', (v_winner_count > 0 OR p_date = v_edition.end_date)
  );
END;
$$;

-- Editar los 10 números de una jugada ya cargada (solo antes de load_limit_date).
CREATE OR REPLACE FUNCTION public.update_polla_bet_numbers(
  p_polla_bet_id UUID,
  p_numbers TEXT[],
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bet polla_bets%ROWTYPE;
  v_edition polla_editions%ROWTYPE;
  v_updated polla_bets%ROWTYPE;
BEGIN
  SELECT * INTO v_bet
  FROM polla_bets
  WHERE polla_bet_id = p_polla_bet_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_BET_NOT_FOUND';
  END IF;

  IF v_bet.winner THEN
    RAISE EXCEPTION 'POLLA_BET_ALREADY_WINNER';
  END IF;

  SELECT * INTO v_edition FROM polla_editions WHERE polla_edition_id = v_bet.polla_edition_id;

  IF CURRENT_DATE > v_edition.load_limit_date THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  IF array_length(p_numbers, 1) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_MUST_BE_TEN';
  END IF;

  UPDATE polla_bets
  SET numbers = p_numbers, hit_numbers = '{}', hits = 0
  WHERE polla_bet_id = p_polla_bet_id
  RETURNING * INTO v_updated;

  RETURN to_jsonb(v_updated);
END;
$$;

-- Borrar (soft-delete) una jugada de Polla y su ticket asociado, solo antes de
-- load_limit_date. Nunca se puede borrar una jugada que ya ganó.
CREATE OR REPLACE FUNCTION public.delete_polla_bet(
  p_polla_bet_id UUID,
  p_organization_id UUID,
  p_deleted_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_bet polla_bets%ROWTYPE;
  v_edition polla_editions%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_bet
  FROM polla_bets
  WHERE polla_bet_id = p_polla_bet_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_BET_NOT_FOUND';
  END IF;

  IF v_bet.winner THEN
    RAISE EXCEPTION 'POLLA_BET_ALREADY_WINNER';
  END IF;

  SELECT * INTO v_edition FROM polla_editions WHERE polla_edition_id = v_bet.polla_edition_id;

  IF CURRENT_DATE > v_edition.load_limit_date THEN
    RAISE EXCEPTION 'POLLA_LOAD_LIMIT_EXCEEDED';
  END IF;

  UPDATE polla_bets
  SET deleted_at = v_now, deleted_by = p_deleted_by
  WHERE polla_bet_id = p_polla_bet_id;

  UPDATE tickets
  SET deleted_at = v_now, deleted_by = p_deleted_by
  WHERE ticket_id = v_bet.ticket_id AND organization_id = p_organization_id;

  RETURN jsonb_build_object('success', true, 'polla_bet_id', p_polla_bet_id);
END;
$$;
