-- Create tickets_archive table with same schema as tickets
-- This table stores archived tickets (older than 3 active days)
-- No indexes by design for space optimization

CREATE TABLE tickets_archive (
  ticket_id UUID PRIMARY KEY,
  user_id UUID,
  user_name TEXT NOT NULL,
  ticket_number INTEGER NOT NULL,
  date DATE NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  winner BOOLEAN NOT NULL DEFAULT false,
  total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  deleted_by UUID DEFAULT NULL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Minimal indexes for archive table (only for specific lookups)
CREATE INDEX idx_tickets_archive_ticket_id ON tickets_archive(ticket_id);
CREATE INDEX idx_tickets_archive_user_id ON tickets_archive(user_id);

-- Optional: Index on date for archive management
CREATE INDEX idx_tickets_archive_date ON tickets_archive(date DESC);
