-- Migration: add org_expenses table
-- Purpose: Persist organization-level daily expenses so range-date totals
--          remain consistent with daily ticket totals.

CREATE TABLE org_expenses (
  expense_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID       NOT NULL,
  date           DATE        NOT NULL,
  name           TEXT        NOT NULL,
  amount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_org_expenses_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(organization_id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_org_expenses_org_date ON org_expenses(organization_id, date);
