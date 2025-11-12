CREATE OR REPLACE VIEW public.total_storage_view AS
SELECT
  sum(total_bytes) AS total_bytes,
  -- Total en Megabytes (MB)
  round((sum(total_bytes) / (1024.0 * 1024.0))::numeric, 2) AS total_mb,
  -- Total en Gigabytes (GB)
  round((sum(total_bytes) / (1024.0 * 1024.0 * 1024.0))::numeric, 2) AS total_gb
FROM (
  SELECT pg_total_relation_size(
    quote_ident(schemaname) || '.' || quote_ident(tablename)
  ) AS total_bytes
  FROM pg_tables
  -- ¡Solo incluye el esquema principal de tus datos!
  WHERE schemaname = 'public' 
) t;
DROP VIEW IF EXISTS public.table_weight_view;
CREATE OR REPLACE VIEW public.table_weight_view AS
SELECT
  tablename,
  -- Tamaño en Megabytes (MB) por tabla
  round((pg_total_relation_size(
    quote_ident(schemaname) || '.' || quote_ident(tablename)
  ) / (1024.0 * 1024.0))::numeric, 2) AS total_mb
FROM pg_tables
WHERE schemaname = 'public' -- Solo incluye el esquema public
ORDER BY
  total_mb DESC;