CREATE OR REPLACE VIEW public.total_storage_view AS
SELECT
  -- Suma total en bytes
  sum(total_bytes) AS total_bytes,
  
  -- Conversión a Megabytes (MB) redondeado a 2 decimales
  round((sum(total_bytes) / (1024.0 * 1024.0))::numeric, 2) AS total_mb,
  
  -- Conversión a Gigabytes (GB) redondeado a 2 decimales
  round((sum(total_bytes) / (1024.0 * 1024.0 * 1024.0))::numeric, 2) AS total_gb
FROM (
  SELECT pg_total_relation_size(
    quote_ident(schemaname) || '.' || quote_ident(tablename)
  ) AS total_bytes
  FROM pg_tables
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema','_realtime')
) t;

CREATE OR REPLACE VIEW public.table_weight_view AS
SELECT
  schemaname,
  tablename,
  -- Conversión a Megabytes (MB) redondeado a 2 decimales
  round((pg_total_relation_size(
    quote_ident(schemaname) || '.' || quote_ident(tablename)
  ) / (1024.0 * 1024.0))::numeric, 2) AS total_mb
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema','_realtime')
ORDER BY
  total_mb DESC;