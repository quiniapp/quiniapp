-- Fix mutable search_path on all public functions.
-- Prevents schema injection attacks where an attacker could shadow system functions
-- by creating objects in a schema that appears earlier in the search path.
-- No behavior change — functions execute identically with an explicit search_path.

DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_options_to_table(p.proconfig)
        WHERE option_name = 'search_path'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public',
      func_record.proname,
      func_record.args
    );
  END LOOP;
END $$;
