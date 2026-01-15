-- Add organization_id to lotteries table
ALTER TABLE lotteries ADD COLUMN organization_id UUID;

-- Add foreign key constraint
ALTER TABLE lotteries ADD CONSTRAINT fk_lotteries_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE RESTRICT;

-- Index for organization-based queries
CREATE INDEX idx_lotteries_organization_id ON lotteries(organization_id);
