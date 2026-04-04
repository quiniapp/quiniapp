-- Add FK constraint and index for users.group_id → organizations
ALTER TABLE users
ADD CONSTRAINT fk_users_group
FOREIGN KEY (group_id) REFERENCES organizations(organization_id) ON DELETE SET NULL
CREATE INDEX idx_users_group_id ON users(group_id)