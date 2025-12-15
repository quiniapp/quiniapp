-- Add active column to schedules table
ALTER TABLE schedules
ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;

-- Add comment to explain the column
COMMENT ON COLUMN schedules.active IS 'Whether this schedule is active and should be shown to users';

-- Create index for better query performance when filtering by active
CREATE INDEX idx_schedules_active ON schedules(active);
