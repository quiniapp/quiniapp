-- Add organization_id to tickets table
ALTER TABLE tickets ADD COLUMN organization_id UUID;

-- Add foreign key constraint
ALTER TABLE tickets ADD CONSTRAINT fk_tickets_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE RESTRICT;

-- Index for organization-based queries
CREATE INDEX idx_tickets_organization_id ON tickets(organization_id);
