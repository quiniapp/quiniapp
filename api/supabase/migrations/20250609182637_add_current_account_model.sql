CREATE TABLE current_accounts (
  current_account_id UUID PRIMARY KEY,
  user_id UUID, -- puede ser NULL
  user_name TEXT NOT NULL,
  user_number INTEGER NOT NULL,

  pass NUMERIC(12, 2) NOT NULL DEFAULT 0,
  successes NUMERIC(12, 2) NOT NULL DEFAULT 0,
  claims NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  previous_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  collections NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  drag NUMERIC(12, 2) NOT NULL DEFAULT 0,
  leave NUMERIC(12, 2) NOT NULL DEFAULT 0,

  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Relaciones
  CONSTRAINT fk_current_account_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
