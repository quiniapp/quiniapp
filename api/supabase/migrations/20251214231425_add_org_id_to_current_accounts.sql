-- Add organization_id to current_accounts table
ALTER TABLE current_accounts ADD COLUMN organization_id UUID;

-- Add foreign key constraint
ALTER TABLE current_accounts ADD CONSTRAINT fk_current_accounts_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE RESTRICT;

-- Index for organization-based queries
CREATE INDEX idx_current_accounts_organization_id ON current_accounts(organization_id);
