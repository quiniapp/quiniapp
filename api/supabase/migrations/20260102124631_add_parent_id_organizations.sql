-- Migration: Add parent_organization_id to organizations table
-- This enables hierarchical organization structure (groups/sub-organizations)

-- Add parent_organization_id column
ALTER TABLE organizations
ADD COLUMN parent_organization_id UUID REFERENCES organizations(organization_id) ON DELETE SET NULL;

-- Create index for hierarchical queries
CREATE INDEX idx_organizations_parent ON organizations(parent_organization_id);

-- Add comment for documentation
COMMENT ON COLUMN organizations.parent_organization_id IS 'Reference to parent organization. NULL means root organization (CAPITALIST level). Non-NULL means sub-organization (group).';
