-- Add organization_id to results table
ALTER TABLE results ADD COLUMN organization_id UUID;

-- Add foreign key constraint
ALTER TABLE results ADD CONSTRAINT fk_results_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE RESTRICT;

-- Index for organization-based queries
CREATE INDEX idx_results_organization_id ON results(organization_id);
