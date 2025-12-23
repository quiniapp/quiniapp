-- Add organization_id to users table
ALTER TABLE users ADD COLUMN organization_id UUID;

-- Add foreign key constraint
ALTER TABLE users ADD CONSTRAINT fk_users_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE RESTRICT;

-- Index for organization-based queries
CREATE INDEX idx_users_organization_id ON users(organization_id);
