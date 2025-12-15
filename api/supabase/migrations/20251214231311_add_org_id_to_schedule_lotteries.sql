-- Add organization_id to schedule_lotteries table
ALTER TABLE schedule_lotteries ADD COLUMN organization_id UUID;

-- Add foreign key constraint
ALTER TABLE schedule_lotteries ADD CONSTRAINT fk_schedule_lotteries_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE RESTRICT;

-- Index for organization-based queries
CREATE INDEX idx_schedule_lotteries_organization_id ON schedule_lotteries(organization_id);
