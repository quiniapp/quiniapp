import 'dotenv/config';

const ENVIROMENT = process.env.ENVIROMENT;

export const PORT = ENVIROMENT === 'DEVELOPMENT' ? process.env.PORT : 3000;
export const URL = ENVIROMENT === 'DEVELOPMENT' ? process.env.URL : 'http://localhost';
export const SUPABASE_URL = process.env.SUPABASE_URL!;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const JWT_SECRET_SUPABASE = process.env.JWT_SECRET_SUPABASE!;
export const JWT_SECRET_USER = process.env.JWT_SECRET_USER!;