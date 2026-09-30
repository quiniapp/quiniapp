-- Polla (sistema independiente): organizaciones, grupos, usuarios, sesiones y
-- catálogos propios. El tenant es el capitalist: una polla_organizations = un
-- capitalist, con sus propias quinielas, turnos, usuarios, pozo y liquidación.

CREATE TYPE polla_user_type_enum AS ENUM (
  'OWNER',
  'CAPITALIST',
  'SUPERADMIN',
  'ADMIN',
  'CASHIER',
  'PLAYER'
);

-- ============================================================
-- Organizaciones (una por capitalist)
-- ============================================================

CREATE TABLE polla_organizations (
  polla_organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX unique_polla_organization_name_active
  ON polla_organizations (name) WHERE deleted_at IS NULL;

-- ============================================================
-- Grupos (agrupación de pasadores dentro de una organización).
-- Tabla real, a diferencia de QuiniApp donde un grupo es una sub-organización.
-- ============================================================

CREATE TABLE polla_groups (
  polla_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX unique_polla_group_name_active
  ON polla_groups (polla_organization_id, name) WHERE deleted_at IS NULL;

-- ============================================================
-- Usuarios
-- ============================================================

CREATE TABLE polla_users (
  polla_user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER,
  user_type polla_user_type_enum NOT NULL,
  name TEXT NOT NULL,
  last_name TEXT,
  phone BIGINT,
  email TEXT,

  -- Auth propia (independiente de QuiniApp)
  username TEXT,
  password_hash TEXT,
  password_changed_at TIMESTAMPTZ,
  password_reset_required BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,

  -- Estructura
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  polla_group_id UUID REFERENCES polla_groups(polla_group_id), -- NULL = sin grupo
  parent_polla_user_id UUID REFERENCES polla_users(polla_user_id), -- solo PLAYER: su cashier

  -- Plata
  fee NUMERIC,           -- % de comisión del pasador
  fee_plus NUMERIC,      -- % de recargo sobre el arrastre
  credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0, -- solo PLAYER

  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT polla_users_role_fields_check CHECK (
    (user_type = 'CASHIER'
      AND fee IS NOT NULL AND fee_plus IS NOT NULL
      AND parent_polla_user_id IS NULL)
    OR
    (user_type = 'PLAYER'
      AND fee IS NULL AND fee_plus IS NULL
      AND parent_polla_user_id IS NOT NULL)
    OR
    (user_type IN ('OWNER', 'CAPITALIST', 'SUPERADMIN', 'ADMIN')
      AND fee IS NULL AND fee_plus IS NULL
      AND parent_polla_user_id IS NULL)
  ),
  CONSTRAINT polla_users_credit_only_player CHECK (
    user_type = 'PLAYER' OR credit_balance = 0
  ),
  CONSTRAINT polla_users_credit_not_negative CHECK (credit_balance >= 0)
);

CREATE UNIQUE INDEX unique_polla_username_active
  ON polla_users (username) WHERE deleted_at IS NULL AND username IS NOT NULL;

CREATE UNIQUE INDEX unique_polla_user_number_active
  ON polla_users (polla_organization_id, number)
  WHERE deleted_at IS NULL AND number IS NOT NULL;

-- El padre de un jugador tiene que ser un CASHIER activo de la misma organización.
CREATE OR REPLACE FUNCTION validate_polla_user_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent_type polla_user_type_enum;
  v_parent_org UUID;
BEGIN
  IF NEW.parent_polla_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_type, polla_organization_id
    INTO v_parent_type, v_parent_org
  FROM polla_users
  WHERE polla_user_id = NEW.parent_polla_user_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_PARENT_NOT_FOUND';
  END IF;

  IF v_parent_type <> 'CASHIER' THEN
    RAISE EXCEPTION 'POLLA_PARENT_NOT_CASHIER';
  END IF;

  IF v_parent_org <> NEW.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_PARENT_OTHER_ORGANIZATION';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_polla_user_parent
  BEFORE INSERT OR UPDATE OF parent_polla_user_id, polla_organization_id ON polla_users
  FOR EACH ROW EXECUTE FUNCTION validate_polla_user_parent();

-- El grupo tiene que ser de la misma organización que el usuario.
CREATE OR REPLACE FUNCTION validate_polla_user_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_group_org UUID;
BEGIN
  IF NEW.polla_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT polla_organization_id INTO v_group_org
  FROM polla_groups
  WHERE polla_group_id = NEW.polla_group_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR v_group_org <> NEW.polla_organization_id THEN
    RAISE EXCEPTION 'POLLA_GROUP_OTHER_ORGANIZATION';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_polla_user_group
  BEFORE INSERT OR UPDATE OF polla_group_id, polla_organization_id ON polla_users
  FOR EACH ROW EXECUTE FUNCTION validate_polla_user_group();

-- ============================================================
-- Sesiones (equivalente reducido de `sessions`: sin SSE ni analytics)
-- ============================================================

CREATE TABLE polla_sessions (
  polla_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_user_id UUID NOT NULL REFERENCES polla_users(polla_user_id) ON DELETE CASCADE,
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  token_version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Catálogos propios: quinielas y turnos
-- ============================================================

CREATE TABLE polla_lotteries (
  polla_lottery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX unique_polla_lottery_name_active
  ON polla_lotteries (polla_organization_id, name) WHERE deleted_at IS NULL;

CREATE TABLE polla_schedules (
  polla_schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polla_organization_id UUID NOT NULL REFERENCES polla_organizations(polla_organization_id),
  name TEXT NOT NULL,
  time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX unique_polla_schedule_name_active
  ON polla_schedules (polla_organization_id, name) WHERE deleted_at IS NULL;

-- ============================================================
-- RLS: el backend entra con service_role (bypassa RLS). Sin policies, igual que
-- el resto del esquema: solo bloquea el acceso directo vía PostgREST con una
-- key anon/authenticated filtrada.
-- ============================================================

ALTER TABLE polla_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE polla_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE polla_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE polla_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE polla_lotteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE polla_schedules ENABLE ROW LEVEL SECURITY;
