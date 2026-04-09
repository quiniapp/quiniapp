CREATE TABLE IF NOT EXISTS analytics_client_stats (
  device_vendor  TEXT NOT NULL DEFAULT 'unknown',
  device_model   TEXT NOT NULL DEFAULT 'unknown',
  os_name        TEXT NOT NULL DEFAULT 'unknown',
  os_version     TEXT NOT NULL DEFAULT 'unknown',
  browser_name   TEXT NOT NULL DEFAULT 'unknown',
  browser_major  TEXT NOT NULL DEFAULT 'unknown',
  count          BIGINT NOT NULL DEFAULT 0,
  last_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_vendor, device_model, os_name, os_version, browser_name, browser_major)
);

-- Batch upsert with atomic increment using UNNEST (one statement, no loop)
CREATE OR REPLACE FUNCTION upsert_client_stats(
  p_vendors        TEXT[],
  p_models         TEXT[],
  p_os_names       TEXT[],
  p_os_versions    TEXT[],
  p_browsers       TEXT[],
  p_browser_majors TEXT[],
  p_counts         BIGINT[]
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO analytics_client_stats
    (device_vendor, device_model, os_name, os_version, browser_name, browser_major, count, last_updated)
  SELECT
    UNNEST(p_vendors),
    UNNEST(p_models),
    UNNEST(p_os_names),
    UNNEST(p_os_versions),
    UNNEST(p_browsers),
    UNNEST(p_browser_majors),
    UNNEST(p_counts),
    NOW()
  ON CONFLICT (device_vendor, device_model, os_name, os_version, browser_name, browser_major)
  DO UPDATE SET
    count        = analytics_client_stats.count + EXCLUDED.count,
    last_updated = NOW();
END;
$$;
