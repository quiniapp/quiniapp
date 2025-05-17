CREATE TABLE tickets (
  ticket_id UUID PRIMARY KEY,
  user_id UUID,
  user_name TEXT NOT NULL,
  ticket_number INTEGER NOT NULL,
  date DATE NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  winner BOOLEAN NOT NULL DEFAULT false,
  total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  deleted_by UUID DEFAULT NULL,

  -- Relación con el usuario dueño del ticket
  CONSTRAINT fk_user FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE SET NULL,

  -- Relación con el usuario que borró el ticket
  CONSTRAINT fk_deleted_by FOREIGN KEY (deleted_by)
    REFERENCES users(user_id)
    ON DELETE SET NULL
);

-- Índices para mejorar rendimiento en consultas por usuario
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
