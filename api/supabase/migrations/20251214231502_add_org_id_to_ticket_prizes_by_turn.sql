-- Add organization_id to ticket_prizes_by_turn table
ALTER TABLE ticket_prizes_by_turn ADD COLUMN organization_id UUID;

-- Add foreign key constraint
ALTER TABLE ticket_prizes_by_turn ADD CONSTRAINT fk_ticket_prizes_by_turn_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(organization_id) ON DELETE RESTRICT;

-- Index for organization-based queries
CREATE INDEX idx_ticket_prizes_by_turn_organization_id ON ticket_prizes_by_turn(organization_id);
