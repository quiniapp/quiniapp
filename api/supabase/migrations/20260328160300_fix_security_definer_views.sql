-- Replace SECURITY DEFINER views with SECURITY INVOKER (default).
-- Both views only access pg_tables and pg_total_relation_size (system catalogs),
-- which are readable by all roles — no permissions regression.

DROP VIEW IF EXISTS public.table_weight_view;
CREATE VIEW public.table_weight_view AS
SELECT
  tablename,
  round(
    (
      pg_total_relation_size(
        (quote_ident(schemaname::text) || '.' || quote_ident(tablename::text))::regclass
      )::numeric / (1024.0 * 1024.0)
    ),
    2
  ) AS total_mb
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY total_mb DESC;

DROP VIEW IF EXISTS public.total_storage_view;
CREATE VIEW public.total_storage_view AS
SELECT
  sum(total_bytes) AS total_bytes,
  round((sum(total_bytes) / (1024.0 * 1024.0)), 2) AS total_mb,
  round((sum(total_bytes) / ((1024.0 * 1024.0) * 1024.0)), 2) AS total_gb
FROM (
  SELECT
    pg_total_relation_size(
      (quote_ident(pg_tables.schemaname::text) || '.' || quote_ident(pg_tables.tablename::text))::regclass
    ) AS total_bytes
  FROM pg_tables
  WHERE pg_tables.schemaname = 'public'
) t;
