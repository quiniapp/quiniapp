import { createClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from 'api/envs';
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// for local
// npx supabase db push --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
