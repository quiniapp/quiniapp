-- Create organizations table for multi-tenancy support
CREATE TABLE organizations (
  organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Index for active organizations lookup
CREATE INDEX idx_organizations_active ON organizations(deleted_at) WHERE deleted_at IS NULL;

-- Comment for documentation
COMMENT ON TABLE organizations IS 'Multi-tenant organizations table. Each organization operates independently with its own users, lotteries, schedules, tickets, bets, and accounts.';
