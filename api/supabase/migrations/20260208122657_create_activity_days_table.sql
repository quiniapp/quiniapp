-- Create activity_days table to track days with betting activity
-- This table is used to determine which data to keep indexed (last 3 active days)
-- and which data to archive

CREATE TABLE activity_days (
  date DATE PRIMARY KEY,
  has_activity BOOLEAN NOT NULL DEFAULT false,
  bets_count INTEGER DEFAULT 0,
  tickets_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying recent active days
CREATE INDEX idx_activity_days_has_activity_date
  ON activity_days(date DESC)
  WHERE has_activity = true;

-- Function to mark a day as active
CREATE OR REPLACE FUNCTION mark_day_as_active(p_date DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO activity_days (date, has_activity, bets_count, tickets_count)
  VALUES (p_date, true, 0, 0)
  ON CONFLICT (date)
  DO UPDATE SET
    has_activity = true,
    updated_at = NOW();
END;
$$;

-- Function to update activity counts for a day
CREATE OR REPLACE FUNCTION update_activity_counts(p_date DATE)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_bets_count INTEGER;
  v_tickets_count INTEGER;
BEGIN
  -- Count bets for the day
  SELECT COUNT(*) INTO v_bets_count
  FROM bets
  WHERE date = p_date AND deleted_at IS NULL;

  -- Count tickets for the day
  SELECT COUNT(*) INTO v_tickets_count
  FROM tickets
  WHERE date = p_date AND deleted_at IS NULL;

  -- Update or insert activity record
  INSERT INTO activity_days (date, has_activity, bets_count, tickets_count)
  VALUES (p_date, (v_bets_count > 0 OR v_tickets_count > 0), v_bets_count, v_tickets_count)
  ON CONFLICT (date)
  DO UPDATE SET
    has_activity = (v_bets_count > 0 OR v_tickets_count > 0),
    bets_count = v_bets_count,
    tickets_count = v_tickets_count,
    updated_at = NOW();
END;
$$;

-- Function to get the last N active days
CREATE OR REPLACE FUNCTION get_last_active_days(p_limit INTEGER DEFAULT 3)
RETURNS TABLE(date DATE)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT ad.date
  FROM activity_days ad
  WHERE ad.has_activity = true
  ORDER BY ad.date DESC
  LIMIT p_limit;
END;
$$;

-- Function to check if a date should be archived (older than last N active days)
CREATE OR REPLACE FUNCTION should_archive_date(p_date DATE, p_days_to_keep INTEGER DEFAULT 3)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff_date DATE;
BEGIN
  -- Get the Nth most recent active day
  SELECT ad.date INTO v_cutoff_date
  FROM activity_days ad
  WHERE ad.has_activity = true
  ORDER BY ad.date DESC
  OFFSET p_days_to_keep - 1
  LIMIT 1;

  -- If we don't have enough active days yet, don't archive
  IF v_cutoff_date IS NULL THEN
    RETURN false;
  END IF;

  -- Archive if date is older than cutoff
  RETURN p_date < v_cutoff_date;
END;
$$;
