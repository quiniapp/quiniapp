import { supabase } from 'api/database/db.connection';

export const getUser = async (id: string) => {
  return await supabase.from('users').select('*').eq('user_id', id).single();
};
