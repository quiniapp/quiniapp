-- Procesa los aciertos diarios de Polla: toma los resultados del día para una
-- quiniela+turno, actualiza los aciertos acumulados de cada jugada activa, y si
-- alguna llega a 10 aciertos reparte el pozo y cierra la edición. El premio se
-- paga con un ticket NUEVO fechado ese mismo día (no retroactivo al día de carga),
-- para que quede incluido en la misma liquidación diaria junto a los demás premios.

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

  -- Acumula aciertos día a día; un acierto de un día anterior nunca se pierde.
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
    AND hits = 10;

  IF v_winner_count > 0 THEN
    v_prize_per_winner := ROUND(v_edition.pool_amount / v_winner_count, 2);

    FOR v_winner IN
      SELECT polla_bet_id, user_id, user_name
      FROM polla_bets
      WHERE polla_edition_id = v_edition.polla_edition_id
        AND winner = FALSE
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

-- Punto de entrada llamado desde generate_winners_and_calculate_accounts: un
-- schedule_id+date puede tener resultados de varias loterías (quiniela) el mismo
-- turno, así que se procesa cada una por separado.
CREATE OR REPLACE FUNCTION public.process_polla_editions_for_schedule_date(
  p_schedule_id UUID,
  p_date DATE,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lottery_id UUID;
  v_result JSONB;
  v_processed INTEGER := 0;
BEGIN
  FOR v_lottery_id IN
    SELECT DISTINCT r.lottery_id
    FROM results r
    WHERE r.schedule_id = p_schedule_id
      AND r.date = p_date
      AND r.organization_id = p_organization_id
      AND r.deleted_at IS NULL
  LOOP
    v_result := process_polla_edition_hits(v_lottery_id, p_schedule_id, p_date, p_organization_id);
    IF v_result IS NOT NULL THEN
      v_processed := v_processed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('editions_processed', v_processed);
END;
$$;
