-- 1. Enums
CREATE TYPE user_type AS ENUM ('OWNER', 'ADMIN', 'CASHIER', 'SUPERADMIN');
CREATE TYPE cashier_type AS ENUM ('PC', 'STREET');

-- 2. Tabla
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  user_type user_type NOT NULL,
  name TEXT NOT NULL,

  username TEXT UNIQUE DEFAULT NULL,
  password TEXT DEFAULT NULL,
  group_id UUID DEFAULT NULL,
  last_name TEXT DEFAULT NULL,
  address TEXT DEFAULT NULL,
  phone BIGINT DEFAULT NULL,
  email TEXT DEFAULT NULL,

  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

  cashier_type cashier_type DEFAULT NULL,
  fee NUMERIC DEFAULT NULL,
  fee_plus NUMERIC DEFAULT NULL,

  -- Validación: si es CASHIER, cashier_type y fees deben existir
  -- si es OWNER o ADMIN, esos campos deben ser nulos
  CHECK (
    (user_type = 'CASHIER' AND cashier_type IS NOT NULL AND fee IS NOT NULL AND fee_plus IS NOT NULL)
    OR
    (user_type IN ('OWNER', 'ADMIN', 'SUPERADMIN') AND cashier_type IS NULL AND fee IS NULL AND fee_plus IS NULL)
  )
);
