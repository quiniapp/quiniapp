-- Polla: nuevo juego de pozo compartido (10 números de 2 cifras, jugado día a día
-- entre fecha_inicio y fecha_fin contra los resultados de una quiniela+turno).

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE polla_edition_status_enum AS ENUM ('ACTIVE', 'FINISHED');

CREATE TABLE polla_editions (
  polla_edition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(organization_id),
  lottery_id UUID NOT NULL REFERENCES lotteries(lottery_id),
  schedule_id UUID NOT NULL REFERENCES schedules(schedule_id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  load_limit_date DATE NOT NULL,
  pool_amount NUMERIC(12,2) NOT NULL CHECK (pool_amount >= 0),
  ticket_price NUMERIC(12,2) NOT NULL CHECK (ticket_price > 0),
  status polla_edition_status_enum NOT NULL DEFAULT 'ACTIVE',
  winner_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (load_limit_date < start_date),
  CHECK (start_date <= end_date)
);

CREATE INDEX idx_polla_editions_org ON polla_editions (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_polla_editions_lottery_schedule ON polla_editions (lottery_id, schedule_id) WHERE deleted_at IS NULL;

-- Una Polla por quiniela+turno a la vez: no se permiten dos ediciones (activa o futura)
-- con rangos de fecha solapados para la misma quiniela+turno.
ALTER TABLE polla_editions ADD CONSTRAINT no_overlapping_polla_editions
  EXCLUDE USING gist (
    lottery_id WITH =,
    schedule_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (deleted_at IS NULL);

CREATE TABLE polla_bets (
  polla_bet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Referencia informativa al ticket que registró el pase (sin FK: ese ticket puede
  -- archivarse/eliminarse físicamente días después por el cron de archivado; los
  -- datos necesarios para pagar el premio ya quedan denormalizados abajo).
  ticket_id UUID NOT NULL,
  polla_edition_id UUID NOT NULL REFERENCES polla_editions(polla_edition_id),
  organization_id UUID NOT NULL REFERENCES organizations(organization_id),
  user_id UUID,
  user_name TEXT NOT NULL,
  load_date DATE NOT NULL,
  numbers TEXT[] NOT NULL,
  hit_numbers TEXT[] NOT NULL DEFAULT '{}',
  hits INTEGER NOT NULL DEFAULT 0,
  winner BOOLEAN NOT NULL DEFAULT FALSE,
  prize NUMERIC(12,2) NOT NULL DEFAULT 0,
  hit_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT polla_bets_numbers_length CHECK (array_length(numbers, 1) = 10)
);

CREATE INDEX idx_polla_bets_edition ON polla_bets (polla_edition_id);
CREATE INDEX idx_polla_bets_edition_pending ON polla_bets (polla_edition_id) WHERE winner = FALSE;
CREATE INDEX idx_polla_bets_ticket ON polla_bets (ticket_id);
CREATE INDEX idx_polla_bets_user ON polla_bets (user_id, load_date);

-- Postgres no tiene un CHECK nativo para "elementos únicos en array".
CREATE OR REPLACE FUNCTION validate_polla_bet_numbers_distinct()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(DISTINCT n) FROM unnest(NEW.numbers) n) <> 10 THEN
    RAISE EXCEPTION 'polla_bets.numbers debe tener 10 valores distintos';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_polla_bet_numbers
  BEFORE INSERT OR UPDATE ON polla_bets
  FOR EACH ROW EXECUTE FUNCTION validate_polla_bet_numbers_distinct();

-- RLS: el backend usa service_role (bypassa RLS); esto solo bloquea acceso directo
-- vía PostgREST con una key anon/authenticated filtrada, igual que el resto de las tablas.
ALTER TABLE polla_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE polla_bets ENABLE ROW LEVEL SECURITY;
