-- Add foreign key constraint for organization_id in schedule_lotteries table
-- This ensures referential integrity and automatic cleanup when organizations are deleted

-- Add foreign key constraint
ALTER TABLE schedule_lotteries
ADD CONSTRAINT fk_organization
FOREIGN KEY (organization_id)
REFERENCES organizations(organization_id)
ON DELETE CASCADE;

-- Add comment for documentation
COMMENT ON CONSTRAINT fk_organization ON schedule_lotteries IS
  'Ensures schedule_lotteries are deleted when their parent organization is deleted';
