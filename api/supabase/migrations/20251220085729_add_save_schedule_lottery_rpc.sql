-- Create RPC function for atomic schedule lottery save
-- This function ensures all delete+insert operations happen in a single transaction
-- Prevents partial updates if something fails during save

CREATE OR REPLACE FUNCTION save_schedule_lottery(
  p_schedule_lottery jsonb,
  p_organization_id uuid
) RETURNS void AS $$
DECLARE
  day_key text;
  day_value jsonb;
  schedule_id_text text;
  schedule_value jsonb;
  day_num smallint;
BEGIN
  -- Process each day in the schedule lottery object
  FOR day_key, day_value IN SELECT * FROM jsonb_each(p_schedule_lottery)
  LOOP
    -- Convert day key (e.g., "MONDAY") to day number (0-6)
    day_num := CASE day_key
      WHEN 'SUNDAY' THEN 0
      WHEN 'MONDAY' THEN 1
      WHEN 'TUESDAY' THEN 2
      WHEN 'WEDNESDAY' THEN 3
      WHEN 'THURSDAY' THEN 4
      WHEN 'FRIDAY' THEN 5
      WHEN 'SATURDAY' THEN 6
      ELSE NULL
    END;

    -- Skip invalid day keys
    IF day_num IS NULL THEN
      RAISE EXCEPTION 'Invalid day key: %', day_key;
    END IF;

    -- Process each schedule for this day
    FOR schedule_id_text, schedule_value IN SELECT * FROM jsonb_each(day_value)
    LOOP
      -- Delete existing records for this day+schedule combination
      DELETE FROM schedule_lotteries
      WHERE organization_id = p_organization_id
        AND day = day_num
        AND schedule_id = schedule_id_text::uuid;

      -- Insert new records for each lottery
      -- Only insert if there are lotteries to add
      IF jsonb_array_length(schedule_value) > 0 THEN
        INSERT INTO schedule_lotteries (organization_id, day, schedule_id, lottery_id)
        SELECT
          p_organization_id,
          day_num,
          schedule_id_text::uuid,
          (jsonb_array_elements_text(schedule_value))::uuid;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the function
COMMENT ON FUNCTION save_schedule_lottery(jsonb, uuid) IS
  'Atomically saves schedule lottery configuration. Deletes existing entries and inserts new ones within a transaction.';
