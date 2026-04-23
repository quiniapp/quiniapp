-- Drop the single-param overload left over from 20260415080624_archive_by_date.sql.
-- Migration 20260422000000 added archive_data_by_date(DATE, INTEGER DEFAULT 5000),
-- which is a different signature so Postgres kept both. PostgREST/RPC calls that pass
-- only p_date now get "could not choose best candidate function" because both match.
-- The two-param version (with batch_size) is the current implementation; remove the old one.

DROP FUNCTION IF EXISTS archive_data_by_date(DATE);
