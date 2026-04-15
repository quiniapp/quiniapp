CREATE TABLE IF NOT EXISTS analytics_device_stats (
  stat_key    TEXT        PRIMARY KEY,
  count       BIGINT      NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic increment upsert — avoids race conditions on concurrent flushes
CREATE OR REPLACE FUNCTION upsert_device_stats(
  p_keys   TEXT[],
  p_counts BIGINT[]
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..array_length(p_keys, 1) LOOP
    INSERT INTO analytics_device_stats (stat_key, count, last_updated)
    VALUES (p_keys[i], p_counts[i], NOW())
    ON CONFLICT (stat_key) DO UPDATE SET
      count        = analytics_device_stats.count + EXCLUDED.count,
      last_updated = NOW();
  END LOOP;
END;
$$;
