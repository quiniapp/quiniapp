-- Add composite partial index on bets(organization_id, date) for the primary listing query.
--
-- Most bet queries filter by:
--   .in('organization_id', org_ids).eq('date', date).is('deleted_at', null)
--
-- The existing idx_bets_organization_id is a single-column index. For multi-org users
-- (OWNER/CAPITALIST) Postgres does a bitmap index scan per org and intersects with a date
-- seq scan — expensive for large tables.
--
-- With this composite partial index, Postgres can satisfy both predicates (org + date)
-- in a single index range scan per org, skipping deleted rows entirely via the WHERE clause.
--
-- Other composite indexes already in place (no duplicates created):
--   idx_bets_schedule_date_org_active  → (schedule_id, date, organization_id) WHERE deleted_at IS NULL
--   idx_bets_user_date_deleted         → (user_id, date, deleted_at)
--   idx_bets_date_schedule_winner_deleted → (date, schedule_id, winner, deleted_at) WHERE winner = true

CREATE INDEX IF NOT EXISTS idx_bets_org_date_active
  ON public.bets(organization_id, date DESC)
  WHERE deleted_at IS NULL;
