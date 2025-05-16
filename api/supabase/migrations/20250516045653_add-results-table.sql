CREATE TABLE results (
  results_id UUID PRIMARY KEY,
  date DATE NOT NULL,
  results INTEGER[] NOT NULL,
  lottery_id UUID NOT NULL REFERENCES lotteries(lottery_id),
  schedule_id UUID NOT NULL REFERENCES schedules(schedule_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CHECK (array_length(results, 1) = 20),
  CONSTRAINT unique_lottery_schedule_date UNIQUE (lottery_id, schedule_id, date)
);

-- Índices individuales para joins y filtros
CREATE INDEX idx_results_lottery_id ON results (lottery_id);
CREATE INDEX idx_results_schedule_id ON results (schedule_id);

-- Índice compuesto para consultas por lotería y fecha
CREATE INDEX idx_lottery_results_lottery_id_date
ON results (lottery_id, date);

-- Índice compuesto para consultas por schedule y fecha
CREATE INDEX idx_results_schedule_id_date
ON results (schedule_id, date);
