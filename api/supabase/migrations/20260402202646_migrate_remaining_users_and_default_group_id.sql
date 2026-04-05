-- 1) Migrate ADMIN users from sub-orgs to root org (keep group_id = sub-org)
UPDATE users u
SET
  group_id        = u.organization_id,
  organization_id = o.parent_organization_id,
  edited_at       = now()
FROM organizations o
WHERE u.organization_id = o.organization_id
  AND o.parent_organization_id IS NOT NULL
  AND u.user_type = 'ADMIN'
  AND u.deleted_at IS NULL;

-- 2) Migrate SUPERADMIN users from sub-orgs to root org
--    SUPERADMINs are NOT assignable to groups, so group_id = parent org (= no group)
UPDATE users u
SET
  group_id        = o.parent_organization_id,
  organization_id = o.parent_organization_id,
  edited_at       = now()
FROM organizations o
WHERE u.organization_id = o.organization_id
  AND o.parent_organization_id IS NOT NULL
  AND u.user_type = 'SUPERADMIN'
  AND u.deleted_at IS NULL;

-- 3) Set group_id = organization_id for ALL users that currently have group_id = NULL
--    Convention: "no group" means group_id = organization_id
UPDATE users
SET
  group_id  = organization_id,
  edited_at = now()
WHERE group_id IS NULL
  AND deleted_at IS NULL;

-- Also set for soft-deleted users to keep data consistent
UPDATE users
SET
  group_id = organization_id
WHERE group_id IS NULL
  AND deleted_at IS NOT NULL;

-- 4) Make group_id NOT NULL now that all rows have a value
ALTER TABLE users ALTER COLUMN group_id SET NOT NULL;
