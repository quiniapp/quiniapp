-- Make organization_id NOT NULL on all tables after data migration
-- This ensures all future records must have an organization

ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE lotteries ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE schedules ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE schedule_lotteries ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE results ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE tickets ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE bets ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE current_accounts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE ticket_prizes_by_turn ALTER COLUMN organization_id SET NOT NULL;
