-- ============================================================================
-- Migration: Add FK constraints to bets_archive for lotteries and schedules
-- ============================================================================
-- Problem: bets_archive has no FK constraints to lotteries/schedules.
--          PostgREST uses FK metadata to resolve join syntax like:
--          .select('*, lotteries(*), schedules(*)')
--          Without these FKs, PGRST200 error is thrown.
-- Solution: Add FK constraints matching the main bets table.
-- ============================================================================

ALTER TABLE bets_archive
ADD CONSTRAINT fk_bets_archive_lottery
  FOREIGN KEY (lottery_id)
  REFERENCES lotteries(lottery_id)
  ON DELETE SET NULL;

ALTER TABLE bets_archive
ADD CONSTRAINT fk_bets_archive_schedule
  FOREIGN KEY (schedule_id)
  REFERENCES schedules(schedule_id)
  ON DELETE SET NULL;

ALTER TABLE bets_archive
ADD CONSTRAINT fk_bets_archive_user
  FOREIGN KEY (user_id)
  REFERENCES users(user_id)
  ON DELETE SET NULL;
