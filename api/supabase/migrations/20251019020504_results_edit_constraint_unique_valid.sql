-- Limpio lo previo (si existiera)
ALTER TABLE public.results
  DROP CONSTRAINT IF EXISTS unique_lottery_schedule_date;

DROP INDEX IF EXISTS unique_lottery_schedule_date;
DROP INDEX IF EXISTS unique_lottery_schedule_date_active;

-- Creo el índice único parcial (aplica solo a filas activas)
CREATE UNIQUE INDEX unique_lottery_schedule_date_active
ON public.results (lottery_id, schedule_id, date)
WHERE deleted_at IS NULL;
