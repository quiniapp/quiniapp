-- =============================================================================
-- Rendimiento SQL, Fase 1c (docs/plan-rendimiento-sql.md): get_archive_stats sin
-- recorrer el archivo.
--
-- Lo llama el cron de archivado dos veces por noche (estadísticas antes y
-- después, solo para el log) y GET /api/private/archive/stats. En prod tardaba
-- ~4,2 s por llamada: COUNT(*) de bets_archive (~3,3M filas, ~1 GB) leído de
-- disco, que además desplaza del cache lo que usa el resto de la app.
--
-- Las tablas principales siguen con COUNT(*) exacto (son chicas: se vacían cada
-- noche). Las de archivo usan pg_stat_user_tables.n_live_tup, que el servidor
-- mantiene en cada insert/delete: es una estimación, no un conteo exacto.
--
-- CREATE OR REPLACE sin DROP: misma firma, conserva grants (solo service_role)
-- y search_path.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_archive_stats()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_bets_main_count BIGINT;
  v_bets_archive_count BIGINT;
  v_tickets_main_count BIGINT;
  v_tickets_archive_count BIGINT;
  v_active_days_count INTEGER;
  v_last_active_date DATE;
BEGIN
  -- Tablas principales: conteo exacto (todas las filas, incluidas las borradas).
  SELECT COUNT(*) INTO v_bets_main_count FROM bets;
  SELECT COUNT(*) INTO v_tickets_main_count FROM tickets;

  -- Archivo: estimación de filas vivas, sin recorrer la tabla.
  SELECT COALESCE(n_live_tup, 0) INTO v_bets_archive_count
  FROM pg_stat_user_tables WHERE relid = 'public.bets_archive'::regclass;
  SELECT COALESCE(n_live_tup, 0) INTO v_tickets_archive_count
  FROM pg_stat_user_tables WHERE relid = 'public.tickets_archive'::regclass;

  SELECT COUNT(*) INTO v_active_days_count
  FROM activity_days WHERE has_activity = true;

  SELECT date INTO v_last_active_date
  FROM activity_days
  WHERE has_activity = true
  ORDER BY date DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'main_tables', jsonb_build_object(
      'bets_count', v_bets_main_count,
      'tickets_count', v_tickets_main_count
    ),
    'archive_tables', jsonb_build_object(
      'bets_count', v_bets_archive_count,
      'tickets_count', v_tickets_archive_count,
      'is_estimate', true
    ),
    'activity', jsonb_build_object(
      'active_days_count', v_active_days_count,
      'last_active_date', v_last_active_date
    ),
    'compression_ratio', jsonb_build_object(
      'bets', CASE
        WHEN v_bets_archive_count > 0
        THEN ROUND((v_bets_archive_count::NUMERIC / (v_bets_main_count + v_bets_archive_count)) * 100, 2)
        ELSE 0
      END,
      'tickets', CASE
        WHEN v_tickets_archive_count > 0
        THEN ROUND((v_tickets_archive_count::NUMERIC / (v_tickets_main_count + v_tickets_archive_count)) * 100, 2)
        ELSE 0
      END
    )
  );
END;
$function$;
