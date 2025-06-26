CREATE TABLE schedule_lotteries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL,
  lottery_id UUID NOT NULL,
  day SMALLINT NOT NULL CHECK (day >= 0 AND day <= 6),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id) ON DELETE CASCADE,
  CONSTRAINT fk_lottery FOREIGN KEY (lottery_id) REFERENCES lotteries(lottery_id) ON DELETE CASCADE,
  CONSTRAINT unique_schedule_lottery_day UNIQUE (schedule_id, lottery_id, day)
);
