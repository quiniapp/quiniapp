CREATE OR REPLACE VIEW public.vista_almacenamiento_tablas AS
SELECT
  schemaname,
  tablename,
  round((pg_total_relation_size(
    quote_ident(schemaname) || '.' || quote_ident(tablename)
  ) / (1024.0 * 1024.0))::numeric, 2) AS total_mb
FROM pg_tables
WHERE 
  -- Excluir esquemas internos de Postgres
  schemaname NOT LIKE 'pg_%' AND
  -- Excluir esquemas internos de Supabase
  schemaname NOT IN (
    'information_schema',
    'realtime',
    '_realtime',
    'storage',
    'graphql',
    'supabase_functions',
    'supabase_migrations'
  )
ORDER BY
  total_mb DESC;

  CREATE OR REPLACE VIEW public.vista_almacenamiento_total AS
SELECT
  sum(total_bytes) AS total_bytes,
  round((sum(total_bytes) / (1024.0 * 1024.0))::numeric, 2) AS total_mb,
  round((sum(total_bytes) / (1024.0 * 1024.0 * 1024.0))::numeric, 2) AS total_gb
FROM (
  SELECT pg_total_relation_size(
    quote_ident(schemaname) || '.' || quote_ident(tablename)
  ) AS total_bytes
  FROM pg_tables
  WHERE 
    -- Excluir esquemas internos de Postgres
    schemaname NOT LIKE 'pg_%' AND 
    -- Excluir esquemas internos de Supabase
    schemaname NOT IN (
      'information_schema',
      'realtime',
      '_realtime', -- El que te dio el error
      'storage',
      'graphql',
      'supabase_functions',
      'supabase_migrations'
    )
) t;