

CREATE TABLE IF NOT EXISTS ticket_prizes_by_turn (
  ticket_id   UUID        NOT NULL REFERENCES tickets(ticket_id)   ON DELETE CASCADE,
  schedule_id UUID        NOT NULL REFERENCES schedules(schedule_id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  prize_turn  NUMERIC(14,2) NOT NULL DEFAULT 0,
  hits_turn   INTEGER     NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ticket_id, schedule_id, date)
);

-- Índices útiles para recomputar por día/turno/ticket
CREATE INDEX IF NOT EXISTS idx_tpt_date_schedule ON ticket_prizes_by_turn(date, schedule_id);
CREATE INDEX IF NOT EXISTS idx_tpt_ticket        ON ticket_prizes_by_turn(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tpt_date          ON ticket_prizes_by_turn(date);


