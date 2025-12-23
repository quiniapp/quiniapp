-- Add organization_id to schedules table
ALTER TABLE schedules ADD COLUMN organization_id UUID;

-- Add foreign key constraint
ALTER TABLE schedules ADD CONSTRAINT fk_schedules_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE RESTRICT;

-- Index for organization-based queries
CREATE INDEX idx_schedules_organization_id ON schedules(organization_id);
