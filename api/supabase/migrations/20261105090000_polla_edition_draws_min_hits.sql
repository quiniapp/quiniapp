-- R26: polla especial. Una edición juega con uno o varios sorteos (pares
-- quiniela × turno) y puede premiar desde un mínimo de aciertos.
--
-- 1. `polla_edition_draws`: los sorteos de cada edición. Las que ya existen
--    quedan con su par. `polla_editions.polla_lottery_id` y `polla_schedule_id`
--    pasan a ser el sorteo principal, el de horario más temprano: con él se
--    siguen calculando el corte de carga (`polla_load_cutoff`) y el control
--    del cierre (`validate_polla_edition_load_limit`), sin cambios.
-- 2. `polla_editions.min_winning_hits` (1 a 10). La regular usa 10; la
--    especial lo elige al crearse (la pantalla propone 8).
-- 3. Regla de premio (`polla_process_edition_hits`):
--    - Los aciertos de un día suman todos los sorteos de la edición, contando
--      repetidos (multiconjunto).
--    - Si alguien completa 10, ganan los que completaron 10 el primer día en
--      que pasó y la edición termina ahí, como hasta ahora.
--    - Si se llega al último día sin nadie en 10, ganan los que tienen más
--      aciertos (9, si no 8, ...) siempre que lleguen al mínimo. Si nadie llega,
--      la edición queda desierta.
--    - Un día define ganadores solo con todos sus sorteos cargados, o si el
--      admin lo define con lo cargado (`polla_edition_forced_days`, para un
--      sorteo que no se hace). Mientras tanto, la respuesta dice qué falta.
--    - El pozo (más el sorpresa) se reparte en partes iguales.
-- 4. Proceso: `polla_process_results_and_accounts` recorre las ediciones que
--    tienen algún sorteo del turno, y `polla_define_edition_day` define un día
--    con los sorteos cargados.
-- 5. Alta y cambios: `polla_create_edition` (atómica, con sus sorteos) y
--    `polla_update_edition` con `draws` y `min_winning_hits`. Con sorteos
--    cargados no se cambian sorteos, mínimo ni inicio; con ganador, solo el
--    nombre.

-- ------------------------------------------------------------------ tablas

CREATE TABLE polla_edition_draws (
  polla_edition_id UUID NOT NULL REFERENCES polla_editions(polla_edition_id) ON DELETE CASCADE,
  polla_lottery_id UUID NOT NULL REFERENCES polla_lotteries(polla_lottery_id),
  polla_schedule_id UUID NOT NULL REFERENCES polla_schedules(polla_schedule_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (polla_edition_id, polla_lottery_id, polla_schedule_id)
);

COMMENT ON TABLE polla_edition_draws IS
  'Sorteos (quiniela × turno) con los que juega cada edición. Los aciertos del día suman todos.';

-- Al procesar un turno se buscan las ediciones que tienen algún sorteo de ese turno.
CREATE INDEX idx_polla_edition_draws_schedule ON polla_edition_draws (polla_schedule_id, polla_edition_id);

ALTER TABLE polla_edition_draws ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE polla_edition_draws FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE polla_edition_draws TO service_role;

INSERT INTO polla_edition_draws (polla_edition_id, polla_lottery_id, polla_schedule_id)
SELECT polla_edition_id, polla_lottery_id, polla_schedule_id
FROM polla_editions;

COMMENT ON COLUMN polla_editions.polla_lottery_id IS
  'Sorteo principal: el de horario más temprano de polla_edition_draws. Con su turno se calcula el corte de carga.';
COMMENT ON COLUMN polla_editions.polla_schedule_id IS
  'Turno del sorteo principal (el más temprano de polla_edition_draws): define el corte de carga.';

ALTER TABLE polla_editions
  ADD COLUMN min_winning_hits SMALLINT NOT NULL DEFAULT 10
    CONSTRAINT polla_editions_min_winning_hits_check CHECK (min_winning_hits BETWEEN 1 AND 10);

COMMENT ON COLUMN polla_editions.min_winning_hits IS
  'Aciertos mínimos para ganar al final de la edición si nadie completó 10. 10 = regular.';

CREATE TABLE polla_edition_forced_days (
  polla_edition_id UUID NOT NULL REFERENCES polla_editions(polla_edition_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  forced_by UUID REFERENCES polla_users(polla_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (polla_edition_id, date)
);

COMMENT ON TABLE polla_edition_forced_days IS
  'Días que el admin definió con los sorteos cargados (un sorteo que no se hizo): cuentan como completos.';

ALTER TABLE polla_edition_forced_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE polla_edition_forced_days FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE polla_edition_forced_days TO service_role;

-- Las ediciones que ya cerraron sin ganador procesando un último día sin
-- resultado quedan como estaban: ese día cuenta como definido. Si no, al
-- reprocesar un día anterior volverían a quedar en juego.
INSERT INTO polla_edition_forced_days (polla_edition_id, date)
SELECT e.polla_edition_id, e.end_date
FROM polla_editions e
WHERE e.status = 'FINISHED'
  AND e.winner_date IS NULL
  AND e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM polla_results r
    WHERE r.polla_organization_id = e.polla_organization_id
      AND r.polla_lottery_id = e.polla_lottery_id
      AND r.polla_schedule_id = e.polla_schedule_id
      AND r.date = e.end_date
      AND r.deleted_at IS NULL
  );

-- El sorteo principal siempre es uno de los sorteos de la edición. También
-- cubre un alta con insert directo (la API anterior, mientras se despliega).
CREATE OR REPLACE FUNCTION polla_edition_principal_draw()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO polla_edition_draws (polla_edition_id, polla_lottery_id, polla_schedule_id)
  VALUES (NEW.polla_edition_id, NEW.polla_lottery_id, NEW.polla_schedule_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_polla_edition_principal_draw ON polla_editions;
CREATE TRIGGER trg_polla_edition_principal_draw
AFTER INSERT ON polla_editions
FOR EACH ROW EXECUTE FUNCTION polla_edition_principal_draw();

-- ------------------------------------------------------------- auxiliares

-- La edición con sus sorteos, ordenados por hora del turno y orden de la quiniela.
CREATE OR REPLACE FUNCTION polla_edition_with_draws(p_edition polla_editions)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_jsonb(p_edition) || jsonb_build_object(
    'draws',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'polla_lottery_id', d.polla_lottery_id,
            'polla_schedule_id', d.polla_schedule_id
          )
          ORDER BY s.time, l."order", l.name
        )
        FROM polla_edition_draws d
        JOIN polla_lotteries l ON l.polla_lottery_id = d.polla_lottery_id
        JOIN polla_schedules s ON s.polla_schedule_id = d.polla_schedule_id
        WHERE d.polla_edition_id = p_edition.polla_edition_id
      ),
      '[]'::JSONB
    )
  );
$$;

-- Sorteos de la edición sin resultado cargado ese día.
CREATE OR REPLACE FUNCTION polla_edition_missing_draws(p_edition_id UUID, p_date DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'polla_lottery_id', d.polla_lottery_id,
        'polla_schedule_id', d.polla_schedule_id
      )
      ORDER BY s.time, l."order", l.name
    ),
    '[]'::JSONB
  )
  FROM polla_edition_draws d
  JOIN polla_editions e ON e.polla_edition_id = d.polla_edition_id
  JOIN polla_lotteries l ON l.polla_lottery_id = d.polla_lottery_id
  JOIN polla_schedules s ON s.polla_schedule_id = d.polla_schedule_id
  WHERE d.polla_edition_id = p_edition_id
    AND NOT EXISTS (
      SELECT 1
      FROM polla_results r
      WHERE r.polla_organization_id = e.polla_organization_id
        AND r.polla_lottery_id = d.polla_lottery_id
        AND r.polla_schedule_id = d.polla_schedule_id
        AND r.date = p_date
        AND r.deleted_at IS NULL
    );
$$;

-- Un día define ganadores con todos sus sorteos cargados o si el admin lo
-- definió con lo cargado.
CREATE OR REPLACE FUNCTION polla_edition_day_complete(p_edition_id UUID, p_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
      SELECT 1 FROM polla_edition_forced_days f
      WHERE f.polla_edition_id = p_edition_id AND f.date = p_date
    )
    OR jsonb_array_length(polla_edition_missing_draws(p_edition_id, p_date)) = 0;
$$;

-- Si un ticket es ganador. Con 10 (`p_winner_hits` = 10), los que completaron
-- los 10 el día ganador; al final de la edición, los que tienen
-- `p_winner_hits` aciertos.
CREATE OR REPLACE FUNCTION polla_is_edition_winner(
  p_hits INTEGER,
  p_hit_dates DATE[],
  p_winner_date DATE,
  p_winner_hits INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE
      WHEN p_winner_date IS NULL THEN FALSE
      WHEN p_winner_hits >= 10 THEN
        p_hits >= 10 AND (SELECT MAX(d) FROM unnest(p_hit_dates) d) = p_winner_date
      ELSE p_hits = p_winner_hits
    END,
    FALSE
  );
$$;

-- Valida los sorteos de un alta o un cambio: al menos uno, de la organización
-- y sin borrar. Devuelve los pares sin repetir (`[{polla_lottery_id,
-- polla_schedule_id}]`), ordenados por hora del turno: el primero es el
-- principal.
CREATE OR REPLACE FUNCTION polla_parse_edition_draws(p_organization_id UUID, p_draws JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_requested INTEGER;
  v_valid INTEGER;
  v_parsed JSONB;
BEGIN
  IF p_draws IS NULL OR jsonb_typeof(p_draws) <> 'array' OR jsonb_array_length(p_draws) = 0 THEN
    RAISE EXCEPTION 'POLLA_EDITION_DRAWS_REQUIRED';
  END IF;

  WITH requested AS (
    SELECT DISTINCT
      (x->>'polla_lottery_id')::UUID AS lottery_id,
      (x->>'polla_schedule_id')::UUID AS schedule_id
    FROM jsonb_array_elements(p_draws) x
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE l.polla_lottery_id IS NOT NULL AND s.polla_schedule_id IS NOT NULL),
    jsonb_agg(
      jsonb_build_object(
        'polla_lottery_id', q.lottery_id,
        'polla_schedule_id', q.schedule_id,
        'time', s.time,
        'order', l."order",
        'name', l.name
      )
    )
  INTO v_requested, v_valid, v_parsed
  FROM requested q
  LEFT JOIN polla_lotteries l
    ON l.polla_lottery_id = q.lottery_id
   AND l.polla_organization_id = p_organization_id
   AND l.deleted_at IS NULL
  LEFT JOIN polla_schedules s
    ON s.polla_schedule_id = q.schedule_id
   AND s.polla_organization_id = p_organization_id
   AND s.deleted_at IS NULL;

  IF v_valid <> v_requested THEN
    RAISE EXCEPTION 'POLLA_EDITION_DRAW_INVALID';
  END IF;

  -- El primero es el principal: el de horario más temprano.
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'polla_lottery_id', d->>'polla_lottery_id',
        'polla_schedule_id', d->>'polla_schedule_id'
      )
      ORDER BY (d->>'time')::TIME, (d->>'order')::INTEGER, d->>'name', d->>'polla_lottery_id'
    )
    FROM jsonb_array_elements(v_parsed) d
  );
END;
$$;

-- -------------------------------------------------------- regla de premio

DROP FUNCTION IF EXISTS polla_process_edition_hits(UUID, DATE);

CREATE OR REPLACE FUNCTION polla_process_edition_hits(p_edition_id UUID, p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
  v_updated INTEGER := 0;
  v_first_ten DATE;
  v_ended BOOLEAN;
  v_pending_date DATE;
  v_winner_date DATE;
  v_winner_hits INTEGER;
  v_top_hits INTEGER;
  v_winner_count INTEGER := 0;
  v_prize NUMERIC(12,2) := 0;
  v_status polla_edition_status_enum;
  v_notice_date DATE;
  v_missing JSONB := '[]'::JSONB;
BEGIN
  -- Una edición que ya tuvo ganador antes de D terminó: los días siguientes no
  -- la afectan. Si el ganador es de D o posterior, D todavía puede cambiarlo.
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND p_date BETWEEN start_date AND end_date
    AND deleted_at IS NULL
    AND NOT (status = 'FINISHED' AND winner_date IS NOT NULL AND winner_date < p_date)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'polla_edition_id', p_edition_id,
      'skipped', true,
      'reason', 'NO_ACTIVE_EDITION'
    );
  END IF;

  WITH drawn AS (
    -- Los 20 números de cada sorteo del día, todos juntos y contando
    -- repetidos: si el 32 sale en dos quinielas (o dos veces en una), llena
    -- dos casilleros con 32.
    SELECT n, COUNT(*) AS k
    FROM polla_edition_draws d
    JOIN polla_results r
      ON r.polla_organization_id = v_edition.polla_organization_id
     AND r.polla_lottery_id = d.polla_lottery_id
     AND r.polla_schedule_id = d.polla_schedule_id
     AND r.date = p_date
     AND r.deleted_at IS NULL
    CROSS JOIN LATERAL unnest(r.results) AS n
    WHERE d.polla_edition_id = v_edition.polla_edition_id
    GROUP BY n
  ),
  slots AS (
    SELECT
      b.polla_bet_id,
      s.idx,
      s.n,
      NULLIF(b.hit_dates[s.idx], p_date) AS kept
    FROM polla_bets b
    CROSS JOIN LATERAL unnest(b.numbers) WITH ORDINALITY AS s(n, idx)
    WHERE b.polla_edition_id = v_edition.polla_edition_id
      AND b.deleted_at IS NULL
  ),
  ranked AS (
    SELECT
      sl.polla_bet_id,
      sl.idx,
      sl.n,
      sl.kept,
      d.k,
      ROW_NUMBER() OVER (
        PARTITION BY sl.polla_bet_id, sl.n, sl.kept IS NULL
        ORDER BY sl.idx
      ) AS rn
    FROM slots sl
    LEFT JOIN drawn d ON d.n = sl.n
  ),
  computed AS (
    SELECT
      polla_bet_id,
      array_agg(
        CASE
          WHEN kept IS NOT NULL THEN kept
          WHEN rn <= k THEN p_date
        END
        ORDER BY idx
      ) AS new_dates,
      array_agg(n ORDER BY idx) FILTER (WHERE kept IS NOT NULL OR rn <= k) AS new_hit_numbers
    FROM ranked
    GROUP BY polla_bet_id
  ),
  applied AS (
    UPDATE polla_bets b
    SET hit_dates = c.new_dates,
        hit_numbers = COALESCE(c.new_hit_numbers, '{}'),
        hits = COALESCE(cardinality(c.new_hit_numbers), 0)
    FROM computed c
    WHERE b.polla_bet_id = c.polla_bet_id
      AND b.hit_dates IS DISTINCT FROM c.new_dates
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_updated FROM applied;

  -- El primer día en que alguien completó los 10.
  SELECT MIN(done) INTO v_first_ten
  FROM (
    SELECT (SELECT MAX(d) FROM unnest(b.hit_dates) d) AS done
    FROM polla_bets b
    WHERE b.polla_edition_id = v_edition.polla_edition_id
      AND b.deleted_at IS NULL
      AND b.hits >= 10
  ) completed;

  -- Llegó al final: se procesa el último día, o ya se había procesado (cerró
  -- sin ganador o con ganador el último día). Si cerró antes con un 10, los
  -- días siguientes no se procesaron y no cuenta como final.
  v_ended := p_date >= v_edition.end_date
    OR (
      v_edition.status = 'FINISHED'
      AND (v_edition.winner_date IS NULL OR v_edition.winner_date >= v_edition.end_date)
    );

  IF v_first_ten IS NOT NULL THEN
    IF polla_edition_day_complete(v_edition.polla_edition_id, v_first_ten) THEN
      v_winner_date := v_first_ten;
      v_winner_hits := 10;
    ELSE
      v_pending_date := v_first_ten;
    END IF;
  ELSIF v_ended THEN
    IF polla_edition_day_complete(v_edition.polla_edition_id, v_edition.end_date) THEN
      -- Nadie completó 10: se baja la escalera hasta el mínimo de la edición.
      IF v_edition.min_winning_hits < 10 THEN
        SELECT MAX(hits) INTO v_top_hits
        FROM polla_bets
        WHERE polla_edition_id = v_edition.polla_edition_id
          AND deleted_at IS NULL;

        IF v_top_hits >= v_edition.min_winning_hits THEN
          v_winner_date := v_edition.end_date;
          v_winner_hits := v_top_hits;
        END IF;
      END IF;
    ELSE
      v_pending_date := v_edition.end_date;
    END IF;
  END IF;

  IF v_winner_date IS NOT NULL THEN
    SELECT COUNT(*) INTO v_winner_count
    FROM polla_bets b
    WHERE b.polla_edition_id = v_edition.polla_edition_id
      AND b.deleted_at IS NULL
      AND polla_is_edition_winner(b.hits, b.hit_dates, v_winner_date, v_winner_hits);

    -- El pozo sorpresa se suma al pozo de la edición; partes iguales.
    v_prize := ROUND((v_edition.pool_amount + v_edition.surprise_pool_amount) / v_winner_count, 2);
  END IF;

  UPDATE polla_bets b
  SET winner = w.is_winner,
      prize = CASE WHEN w.is_winner THEN v_prize ELSE 0 END,
      hit_date = CASE WHEN w.is_winner THEN v_winner_date END
  FROM (
    SELECT
      polla_bet_id,
      polla_is_edition_winner(hits, hit_dates, v_winner_date, v_winner_hits) AS is_winner
    FROM polla_bets
    WHERE polla_edition_id = v_edition.polla_edition_id
      AND deleted_at IS NULL
  ) w
  WHERE b.polla_bet_id = w.polla_bet_id
    AND (
      b.winner IS DISTINCT FROM w.is_winner
      OR b.prize IS DISTINCT FROM (CASE WHEN w.is_winner THEN v_prize ELSE 0 END)
      OR b.hit_date IS DISTINCT FROM (CASE WHEN w.is_winner THEN v_winner_date END)
    );

  v_status := CASE
    WHEN v_winner_date IS NOT NULL THEN 'FINISHED'
    -- Llegó al final con el último día definido y nadie alcanzó el mínimo: desierta.
    WHEN v_ended AND v_pending_date IS NULL THEN 'FINISHED'
    ELSE 'ACTIVE'
  END::polla_edition_status_enum;

  UPDATE polla_editions
  SET status = v_status,
      winner_date = v_winner_date,
      edited_at = NOW()
  WHERE polla_edition_id = v_edition.polla_edition_id
    AND (status IS DISTINCT FROM v_status OR winner_date IS DISTINCT FROM v_winner_date);

  -- Qué falta: del día que frena a los ganadores o, si no, del día procesado.
  v_notice_date := COALESCE(v_pending_date, p_date);
  IF NOT polla_edition_day_complete(v_edition.polla_edition_id, v_notice_date) THEN
    v_missing := polla_edition_missing_draws(v_edition.polla_edition_id, v_notice_date);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'polla_edition_id', v_edition.polla_edition_id,
    'date', p_date,
    'bets_updated', v_updated,
    'winners', v_winner_count,
    'winner_hits', v_winner_hits,
    'min_winning_hits', v_edition.min_winning_hits,
    'prize_per_winner', v_prize,
    'winner_date', v_winner_date,
    'previous_winner_date', v_edition.winner_date,
    -- Los ganadores esperan a que se carguen los sorteos que faltan de este día.
    'pending_date', v_pending_date,
    'missing_date', CASE WHEN jsonb_array_length(v_missing) > 0 THEN v_notice_date END,
    'missing_draws', v_missing,
    -- La edición se reabrió: los días posteriores ya cargados hay que procesarlos.
    'reopened', v_edition.status = 'FINISHED' AND v_status = 'ACTIVE'
  );
END;
$$;

-- ------------------------------------------------------------------ proceso

-- Recalcula la cuenta corriente de esos días y arrastra el saldo a los siguientes.
CREATE OR REPLACE FUNCTION polla_recalculate_accounts_on(p_organization_id UUID, p_dates DATE[])
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_date DATE;
  v_accounts JSONB[];
  v_accounts_updated INTEGER := 0;
BEGIN
  FOR v_date IN SELECT DISTINCT d FROM unnest(p_dates) d WHERE d IS NOT NULL ORDER BY d LOOP
    v_accounts := polla_calculate_current_account(
      to_char(v_date, 'DD-MM-YYYY'),
      FALSE,
      FALSE,
      p_organization_id
    );
    v_accounts_updated := v_accounts_updated + COALESCE(array_length(v_accounts, 1), 0);

    PERFORM polla_cascade_current_account_from_date(
      to_char(v_date, 'DD-MM-YYYY'),
      p_organization_id
    );
  END LOOP;

  RETURN v_accounts_updated;
END;
$$;

DROP FUNCTION IF EXISTS polla_process_results_and_accounts(UUID, UUID, DATE);

CREATE OR REPLACE FUNCTION polla_process_results_and_accounts(
  p_organization_id UUID,
  p_schedule_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
SET statement_timeout = '300000'
AS $$
DECLARE
  v_edition RECORD;
  v_processed JSONB;
  v_results JSONB[] := '{}';
  v_dates DATE[] := ARRAY[p_date];
BEGIN
  -- Se recorren las ediciones con algún sorteo del turno que cubren el día, no
  -- los resultados: si se borró un resultado mal cargado, reprocesar igual
  -- limpia sus aciertos. Cada edición se procesa con todos sus sorteos.
  FOR v_edition IN
    SELECT e.polla_edition_id
    FROM polla_editions e
    WHERE e.polla_organization_id = p_organization_id
      AND p_date BETWEEN e.start_date AND e.end_date
      AND e.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM polla_edition_draws d
        WHERE d.polla_edition_id = e.polla_edition_id
          AND d.polla_schedule_id = p_schedule_id
      )
    ORDER BY e.start_date, e.created_at
  LOOP
    v_processed := polla_process_edition_hits(v_edition.polla_edition_id, p_date);
    v_results := v_results || v_processed;

    -- El premio se imputa en la cuenta corriente del día ganador: si el
    -- reproceso movió o revirtió un ganador, esos días también se recalculan.
    v_dates := v_dates
      || (v_processed->>'winner_date')::DATE
      || (v_processed->>'previous_winner_date')::DATE;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'polla_organization_id', p_organization_id,
    'polla_schedule_id', p_schedule_id,
    'date', p_date,
    'editions', to_jsonb(v_results),
    'accounts_updated', polla_recalculate_accounts_on(p_organization_id, v_dates)
  );
END;
$$;

-- "Definir con lo cargado": el día cuenta como completo aunque le falte un
-- sorteo (uno que no se hizo) y se vuelve a procesar.
CREATE OR REPLACE FUNCTION polla_define_edition_day(
  p_edition_id UUID,
  p_date DATE,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
SET statement_timeout = '300000'
AS $$
DECLARE
  v_edition polla_editions;
  v_processed JSONB;
BEGIN
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF p_date NOT BETWEEN v_edition.start_date AND v_edition.end_date THEN
    RAISE EXCEPTION 'POLLA_EDITION_DATE_OUT_OF_RANGE';
  END IF;

  INSERT INTO polla_edition_forced_days (polla_edition_id, date, forced_by)
  VALUES (p_edition_id, p_date, p_actor_id)
  ON CONFLICT DO NOTHING;

  v_processed := polla_process_edition_hits(p_edition_id, p_date);

  RETURN jsonb_build_object(
    'success', true,
    'polla_organization_id', v_edition.polla_organization_id,
    'date', p_date,
    'editions', jsonb_build_array(v_processed),
    'accounts_updated', polla_recalculate_accounts_on(
      v_edition.polla_organization_id,
      ARRAY[
        p_date,
        (v_processed->>'winner_date')::DATE,
        (v_processed->>'previous_winner_date')::DATE
      ]
    )
  );
END;
$$;

-- ------------------------------------------------------- alta y cambios

CREATE OR REPLACE FUNCTION polla_create_edition(
  p_organization_id UUID,
  p_payload JSONB,
  p_draws JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_draws JSONB;
  v_edition polla_editions;
BEGIN
  v_draws := polla_parse_edition_draws(p_organization_id, p_draws);

  -- El trigger del cierre de carga lo valida contra el sorteo principal (el
  -- más temprano) y el de la edición agrega ese sorteo.
  INSERT INTO polla_editions (
    polla_organization_id,
    polla_lottery_id,
    polla_schedule_id,
    name,
    start_date,
    end_date,
    load_limit_date,
    load_limit_time,
    pool_amount,
    surprise_pool_amount,
    ticket_price,
    min_winning_hits
  ) VALUES (
    p_organization_id,
    (v_draws->0->>'polla_lottery_id')::UUID,
    (v_draws->0->>'polla_schedule_id')::UUID,
    NULLIF(p_payload->>'name', ''),
    (p_payload->>'start_date')::DATE,
    (p_payload->>'end_date')::DATE,
    (p_payload->>'load_limit_date')::DATE,
    (p_payload->>'load_limit_time')::TIME,
    (p_payload->>'pool_amount')::NUMERIC,
    COALESCE((p_payload->>'surprise_pool_amount')::NUMERIC, 0),
    (p_payload->>'ticket_price')::NUMERIC,
    COALESCE((p_payload->>'min_winning_hits')::SMALLINT, 10)
  )
  RETURNING * INTO v_edition;

  INSERT INTO polla_edition_draws (polla_edition_id, polla_lottery_id, polla_schedule_id)
  SELECT v_edition.polla_edition_id, (d->>'polla_lottery_id')::UUID, (d->>'polla_schedule_id')::UUID
  FROM jsonb_array_elements(v_draws) d
  ON CONFLICT DO NOTHING;

  RETURN polla_edition_with_draws(v_edition);
END;
$$;

DROP FUNCTION IF EXISTS polla_update_edition(UUID, JSONB);

CREATE OR REPLACE FUNCTION polla_update_edition(p_edition_id UUID, p_changes JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old polla_editions;
  v_new polla_editions;
  v_last_draw DATE;
  v_draws JSONB;
  v_old_draws TEXT[];
  v_new_draws TEXT[];
  v_draws_changed BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_old
  FROM polla_editions
  WHERE polla_edition_id = p_edition_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  v_new := v_old;
  IF p_changes ? 'name' THEN v_new.name := p_changes->>'name'; END IF;
  IF p_changes ? 'start_date' THEN v_new.start_date := (p_changes->>'start_date')::DATE; END IF;
  IF p_changes ? 'end_date' THEN v_new.end_date := (p_changes->>'end_date')::DATE; END IF;
  IF p_changes ? 'load_limit_date' THEN v_new.load_limit_date := (p_changes->>'load_limit_date')::DATE; END IF;
  IF p_changes ? 'load_limit_time' THEN v_new.load_limit_time := (p_changes->>'load_limit_time')::TIME; END IF;
  IF p_changes ? 'pool_amount' THEN v_new.pool_amount := (p_changes->>'pool_amount')::NUMERIC; END IF;
  IF p_changes ? 'surprise_pool_amount' THEN v_new.surprise_pool_amount := (p_changes->>'surprise_pool_amount')::NUMERIC; END IF;
  -- El precio vale para las jugadas nuevas: cada jugada guarda el suyo.
  IF p_changes ? 'ticket_price' THEN v_new.ticket_price := (p_changes->>'ticket_price')::NUMERIC; END IF;
  IF p_changes ? 'min_winning_hits' THEN v_new.min_winning_hits := (p_changes->>'min_winning_hits')::SMALLINT; END IF;

  SELECT array_agg(polla_lottery_id::TEXT || '/' || polla_schedule_id::TEXT ORDER BY 1)
  INTO v_old_draws
  FROM polla_edition_draws
  WHERE polla_edition_id = p_edition_id;

  v_draws := p_changes->'draws';
  -- La API anterior manda quiniela y turno sueltos: valen como el único
  -- sorteo de una edición que tiene uno solo.
  IF v_draws IS NULL
     AND (p_changes ? 'polla_lottery_id' OR p_changes ? 'polla_schedule_id')
     AND cardinality(v_old_draws) = 1 THEN
    v_draws := jsonb_build_array(jsonb_build_object(
      'polla_lottery_id', COALESCE(p_changes->>'polla_lottery_id', v_old.polla_lottery_id::TEXT),
      'polla_schedule_id', COALESCE(p_changes->>'polla_schedule_id', v_old.polla_schedule_id::TEXT)
    ));
  END IF;

  IF v_draws IS NOT NULL THEN
    v_draws := polla_parse_edition_draws(v_old.polla_organization_id, v_draws);

    SELECT array_agg((d->>'polla_lottery_id') || '/' || (d->>'polla_schedule_id') ORDER BY 1)
    INTO v_new_draws
    FROM jsonb_array_elements(v_draws) d;

    v_draws_changed := v_new_draws IS DISTINCT FROM v_old_draws;
    v_new.polla_lottery_id := (v_draws->0->>'polla_lottery_id')::UUID;
    v_new.polla_schedule_id := (v_draws->0->>'polla_schedule_id')::UUID;
  END IF;

  -- Con ganador, el premio ya se repartió: solo se renombra.
  IF v_old.winner_date IS NOT NULL AND (
       v_draws_changed
    OR v_new.start_date <> v_old.start_date
    OR v_new.end_date <> v_old.end_date
    OR v_new.load_limit_date <> v_old.load_limit_date
    OR v_new.load_limit_time <> v_old.load_limit_time
    OR v_new.pool_amount <> v_old.pool_amount
    OR v_new.surprise_pool_amount <> v_old.surprise_pool_amount
    OR v_new.ticket_price <> v_old.ticket_price
    OR v_new.min_winning_hits <> v_old.min_winning_hits
  ) THEN
    RAISE EXCEPTION 'POLLA_EDITION_HAS_WINNERS_LOCKED';
  END IF;

  -- Último sorteo con resultados dentro de la edición, de cualquiera de sus sorteos.
  SELECT MAX(r.date) INTO v_last_draw
  FROM polla_edition_draws d
  JOIN polla_results r
    ON r.polla_organization_id = v_old.polla_organization_id
   AND r.polla_lottery_id = d.polla_lottery_id
   AND r.polla_schedule_id = d.polla_schedule_id
  WHERE d.polla_edition_id = p_edition_id
    AND r.date BETWEEN v_old.start_date AND v_old.end_date
    AND r.deleted_at IS NULL;

  IF v_last_draw IS NOT NULL THEN
    IF v_draws_changed
       OR v_new.start_date <> v_old.start_date
       OR v_new.min_winning_hits <> v_old.min_winning_hits THEN
      RAISE EXCEPTION 'POLLA_EDITION_DRAWS_LOCKED';
    END IF;

    IF v_new.end_date < v_last_draw THEN
      RAISE EXCEPTION 'POLLA_EDITION_END_BEFORE_DRAW';
    END IF;
  END IF;

  -- Extender una edición que terminó sin ganador la vuelve a poner en juego,
  -- salvo que ya se hayan repetido tickets sin cargo desde ella.
  IF v_new.end_date > v_old.end_date AND v_old.status = 'FINISHED' AND v_old.winner_date IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM polla_bets r
      JOIN polla_bets s ON s.polla_bet_id = r.repeated_from_bet_id
      WHERE s.polla_edition_id = p_edition_id
        AND r.is_free
        AND r.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'POLLA_EDITION_EXTEND_AFTER_FREE_REPEAT';
    END IF;

    v_new.status := 'ACTIVE';
  END IF;

  UPDATE polla_editions
  SET name = v_new.name,
      polla_lottery_id = v_new.polla_lottery_id,
      polla_schedule_id = v_new.polla_schedule_id,
      start_date = v_new.start_date,
      end_date = v_new.end_date,
      load_limit_date = v_new.load_limit_date,
      load_limit_time = v_new.load_limit_time,
      pool_amount = v_new.pool_amount,
      surprise_pool_amount = v_new.surprise_pool_amount,
      ticket_price = v_new.ticket_price,
      min_winning_hits = v_new.min_winning_hits,
      status = v_new.status,
      edited_at = NOW()
  WHERE polla_edition_id = p_edition_id
  RETURNING * INTO v_new;

  IF v_draws_changed THEN
    DELETE FROM polla_edition_draws WHERE polla_edition_id = p_edition_id;
    INSERT INTO polla_edition_draws (polla_edition_id, polla_lottery_id, polla_schedule_id)
    SELECT p_edition_id, (d->>'polla_lottery_id')::UUID, (d->>'polla_schedule_id')::UUID
    FROM jsonb_array_elements(v_draws) d;
  END IF;

  RETURN polla_edition_with_draws(v_new);
END;
$$;

-- Cargar jugada: las ediciones con la carga abierta, cada una con sus sorteos.
CREATE OR REPLACE FUNCTION polla_loadable_editions(p_organization_id UUID, p_role polla_user_type_enum)
RETURNS SETOF JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT polla_edition_with_draws(e) || jsonb_build_object(
    'my_load_cutoff', polla_load_cutoff(e, p_role)
  )
  FROM polla_editions e
  WHERE e.polla_organization_id = p_organization_id
    AND e.deleted_at IS NULL
    AND e.status = 'ACTIVE'
    AND polla_can_load(e, p_role)
  ORDER BY e.start_date DESC;
$$;

-- ---------------------------------------------------------------- permisos

REVOKE ALL ON FUNCTION polla_edition_principal_draw() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_principal_draw() TO service_role;
REVOKE ALL ON FUNCTION polla_edition_with_draws(polla_editions) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_with_draws(polla_editions) TO service_role;
REVOKE ALL ON FUNCTION polla_edition_missing_draws(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_missing_draws(UUID, DATE) TO service_role;
REVOKE ALL ON FUNCTION polla_edition_day_complete(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_day_complete(UUID, DATE) TO service_role;
REVOKE ALL ON FUNCTION polla_is_edition_winner(INTEGER, DATE[], DATE, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_is_edition_winner(INTEGER, DATE[], DATE, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION polla_parse_edition_draws(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_parse_edition_draws(UUID, JSONB) TO service_role;
REVOKE ALL ON FUNCTION polla_process_edition_hits(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_process_edition_hits(UUID, DATE) TO service_role;
REVOKE ALL ON FUNCTION polla_recalculate_accounts_on(UUID, DATE[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_recalculate_accounts_on(UUID, DATE[]) TO service_role;
REVOKE ALL ON FUNCTION polla_process_results_and_accounts(UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_process_results_and_accounts(UUID, UUID, DATE) TO service_role;
REVOKE ALL ON FUNCTION polla_define_edition_day(UUID, DATE, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_define_edition_day(UUID, DATE, UUID) TO service_role;
REVOKE ALL ON FUNCTION polla_create_edition(UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_create_edition(UUID, JSONB, JSONB) TO service_role;
REVOKE ALL ON FUNCTION polla_update_edition(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_update_edition(UUID, JSONB) TO service_role;
REVOKE ALL ON FUNCTION polla_loadable_editions(UUID, polla_user_type_enum) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_loadable_editions(UUID, polla_user_type_enum) TO service_role;

-- ROLLBACK:
-- Antes de volver atrás hay que borrar (o dejar con un solo sorteo y mínimo
-- 10) las ediciones especiales: la regla vieja solo mira el sorteo principal.
-- Los datos de las ediciones regulares no se pierden (su par sigue en
-- polla_editions).
--
-- DROP FUNCTION IF EXISTS polla_define_edition_day(UUID, DATE, UUID);
-- DROP FUNCTION IF EXISTS polla_create_edition(UUID, JSONB, JSONB);
-- DROP FUNCTION IF EXISTS polla_recalculate_accounts_on(UUID, DATE[]);
-- DROP FUNCTION IF EXISTS polla_parse_edition_draws(UUID, JSONB);
-- DROP FUNCTION IF EXISTS polla_is_edition_winner(INTEGER, DATE[], DATE, INTEGER);
-- DROP TRIGGER IF EXISTS trg_polla_edition_principal_draw ON polla_editions;
-- DROP FUNCTION IF EXISTS polla_edition_principal_draw();
-- Volver a crear con las definiciones anteriores:
--   polla_process_edition_hits(UUID, DATE) y polla_process_results_and_accounts(UUID, UUID, DATE)
--     de 20261105080000_polla_overlapping_editions.sql
--   polla_update_edition(UUID, JSONB) y polla_loadable_editions(UUID, polla_user_type_enum)
--     de 20261021233444_polla_cutoffs_editions_repeat.sql
-- DROP FUNCTION IF EXISTS polla_edition_day_complete(UUID, DATE);
-- DROP FUNCTION IF EXISTS polla_edition_missing_draws(UUID, DATE);
-- DROP FUNCTION IF EXISTS polla_edition_with_draws(polla_editions);
-- DROP TABLE IF EXISTS polla_edition_forced_days;
-- DROP TABLE IF EXISTS polla_edition_draws;
-- ALTER TABLE polla_editions DROP COLUMN IF EXISTS min_winning_hits;
-- COMMENT ON COLUMN polla_editions.polla_lottery_id IS NULL;
-- COMMENT ON COLUMN polla_editions.polla_schedule_id IS NULL;
