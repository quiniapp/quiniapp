CREATE INDEX IF NOT EXISTS idx_tickets_date ON public.tickets USING btree (date);
CREATE INDEX IF NOT EXISTS idx_bets_date ON public.bets USING btree (date);
CREATE INDEX IF NOT EXISTS idx_bets_paid ON public.bets USING btree (paid);
CREATE INDEX IF NOT EXISTS idx_schedule_lotteries_day ON public.schedule_lotteries USING btree (day);
CREATE INDEX IF NOT EXISTS idx_sessions_device_fingerprint ON public.sessions USING btree (device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_tickets_total_prize ON public.tickets USING btree (total_prize);
