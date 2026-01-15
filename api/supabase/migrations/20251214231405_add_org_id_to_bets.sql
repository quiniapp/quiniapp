-- Add organization_id to bets table
ALTER TABLE bets ADD COLUMN organization_id UUID;

-- Add foreign key constraint
ALTER TABLE bets ADD CONSTRAINT fk_bets_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE RESTRICT;

-- Index for organization-based queries
CREATE INDEX idx_bets_organization_id ON bets(organization_id);
