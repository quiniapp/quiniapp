-- Migrate cashiers from sub-orgs: move their sub-org id to group_id
-- and restore organization_id to the parent org.
-- Only affects CASHIERs that are currently assigned to a sub-org (group).

UPDATE users u
SET
  group_id        = u.organization_id,
  organization_id = o.parent_organization_id,
  edited_at       = now()
FROM organizations o
WHERE u.organization_id = o.organization_id
  AND o.parent_organization_id IS NOT NULL
  AND u.user_type = 'CASHIER'
  AND u.deleted_at IS NULL;

-- Update current_accounts so their organization_id matches the parent org
-- (aligns with the new model where all accounts belong to the root org)
UPDATE current_accounts ca
SET
  organization_id = o.parent_organization_id,
  edited_at       = now()
FROM organizations o
WHERE ca.organization_id = o.organization_id
  AND o.parent_organization_id IS NOT NULL;