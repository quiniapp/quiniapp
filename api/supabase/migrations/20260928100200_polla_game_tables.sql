-- Polla (sistema independiente): ediciones, resultados, jugadas, créditos y
-- cuenta corriente. Todo cuelga de polla_organization_id (= un capitalist).

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE polla_edition_status_enum AS ENUM ('ACTIVE', 'FINISHED');

CREATE TYPE polla_credit_movement_type_enum AS ENUM (
  'LOAD',        -- el pasador carga créditos al jugador
  'WITHDRAW',    -- el pasador retira créditos
  'BET',         -- débito automático al cargar una jugada
  'BET_REFUND',  -- devolución automática al borrar una jugada
  'ADJUSTMENT'   -- ajuste manual de admin
);

-- ============================================================
-- Ediciones
-- ============================================================

CREATE TABLE polla_editions (
  polla_edition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  polla_lottery_id UUID NOT NULL REFERENCES polla_lotteries(polla_lottery_id),
  polla_schedule_id UUID NOT NULL REFERENCES polla_schedules(polla_schedule_id),
  name TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  load_limit_date DATE NOT NULL,
  pool_amount NUMERIC(12,2) NOT NULL CHECK (pool_amount >= 0),
  ticket_price NUMERIC(12,2) NOT NULL CHECK (ticket_price > 0),
  status polla_edition_status_enum NOT NULL DEFAULT 'ACTIVE',
  winner_date DATE,
  -- Contadores denormalizados, mantenidos por las RPCs de alta/baja de jugadas:
  -- el panel de la edición no escanea polla_bets.
  bets_count INTEGER NOT NULL DEFAULT 0,
  collected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (load_limit_date < start_date),
  CHECK (start_date <= end_date)
);

-- Sin solapamiento dentro de un capitalist; dos capitalists sí pueden correr la
-- misma quiniela+turno la misma semana, cada uno con su pozo.
ALTER TABLE polla_editions ADD CONSTRAINT no_overlapping_polla_editions
  EXCLUDE USING gist (
    polla_organization_id WITH =,
    polla_lottery_id WITH =,
    polla_schedule_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (deleted_at IS NULL);

-- ============================================================
-- Resultados (carga manual, por organización)
-- ============================================================

CREATE TABLE polla_results (
  polla_result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  polla_lottery_id UUID NOT NULL REFERENCES polla_lotteries(polla_lottery_id),
  polla_schedule_id UUID NOT NULL REFERENCES polla_schedules(polla_schedule_id),
  date DATE NOT NULL,
  results TEXT[] NOT NULL,
  loaded_by UUID REFERENCES polla_users(polla_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT polla_results_length CHECK (array_length(results, 1) = 20)
);

CREATE UNIQUE INDEX unique_polla_result_active
  ON polla_results (polla_organization_id, polla_lottery_id, polla_schedule_id, date)
  WHERE deleted_at IS NULL;

-- ============================================================
-- Jugadas
-- ============================================================

CREATE TABLE polla_bets (
  polla_bet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL,
  polla_edition_id UUID NOT NULL REFERENCES polla_editions(polla_edition_id),

  -- Dueño de la jugada (jugador o pasador) y pasador al que se le imputa la
  -- plata: si el dueño es un PLAYER, es su padre; si es CASHIER, es él mismo.
  polla_user_id UUID NOT NULL REFERENCES polla_users(polla_user_id),
  cashier_polla_user_id UUID NOT NULL REFERENCES polla_users(polla_user_id),

  -- Denormalizado al insertar: la query caliente del feed no hace joins.
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  polla_group_id UUID REFERENCES polla_groups(polla_group_id),
  user_name TEXT NOT NULL,
  cashier_name TEXT NOT NULL,
  cashier_number INTEGER,

  load_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  numbers TEXT[] NOT NULL,
  hit_numbers TEXT[] NOT NULL DEFAULT '{}',
  hits INTEGER NOT NULL DEFAULT 0,
  winner BOOLEAN NOT NULL DEFAULT FALSE,
  prize NUMERIC(12,2) NOT NULL DEFAULT 0,
  hit_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES polla_users(polla_user_id),

  CONSTRAINT polla_bets_numbers_length CHECK (array_length(numbers, 1) = 10)
);

CREATE UNIQUE INDEX unique_polla_bet_ticket_number ON polla_bets (ticket_number);

-- Postgres no tiene un CHECK nativo para "elementos únicos en array".
CREATE OR REPLACE FUNCTION validate_polla_bet_numbers_distinct()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM unnest(NEW.numbers) n WHERE n !~ '^\d{2}$') > 0 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_INVALID';
  END IF;

  IF (SELECT COUNT(DISTINCT n) FROM unnest(NEW.numbers) n) <> 10 THEN
    RAISE EXCEPTION 'POLLA_NUMBERS_NOT_DISTINCT';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_polla_bet_numbers
  BEFORE INSERT OR UPDATE OF numbers ON polla_bets
  FOR EACH ROW EXECUTE FUNCTION validate_polla_bet_numbers_distinct();

-- ============================================================
-- Créditos de los jugadores (ledger + saldo denormalizado en polla_users)
-- ============================================================

CREATE TABLE polla_credit_movements (
  polla_credit_movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_user_id UUID NOT NULL REFERENCES polla_users(polla_user_id),
  cashier_polla_user_id UUID NOT NULL REFERENCES polla_users(polla_user_id),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  created_by_polla_user_id UUID REFERENCES polla_users(polla_user_id),
  type polla_credit_movement_type_enum NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount <> 0), -- con signo
  balance_after NUMERIC(12,2) NOT NULL,
  polla_bet_id UUID REFERENCES polla_bets(polla_bet_id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Cuenta corriente (una fila por pasador y día, con arrastre)
-- ============================================================

CREATE TABLE polla_current_accounts (
  polla_current_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_user_id UUID NOT NULL REFERENCES polla_users(polla_user_id),
  user_name TEXT NOT NULL,
  user_number INTEGER,
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  polla_group_id UUID REFERENCES polla_groups(polla_group_id),
  date DATE NOT NULL,

  pass NUMERIC(12,2) NOT NULL DEFAULT 0,
  successes NUMERIC(12,2) NOT NULL DEFAULT 0,
  cashier_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  claims NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  previous_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  previous_drag NUMERIC(12,2) NOT NULL DEFAULT 0,
  collections NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  bills NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  drag NUMERIC(12,2) NOT NULL DEFAULT 0,
  leave NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_liquidated BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT polla_current_accounts_user_date_uniq UNIQUE (polla_user_id, date)
);

ALTER TABLE polla_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE polla_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE polla_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE polla_credit_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE polla_current_accounts ENABLE ROW LEVEL SECURITY;
