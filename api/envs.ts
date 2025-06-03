import 'dotenv/config';

const ENVIROMENT = process.env.ENVIROMENT;
const DATABASE_ENVIROMENT = process.env.SUPABASE_ENVIROMENT;

export const JWT_SECRET_USER = process.env.JWT_SECRET_USER!;
//api
export const PORT = ENVIROMENT === 'DEVELOPMENT' ? process.env.PORT : 3000;
export const URL = ENVIROMENT === 'DEVELOPMENT' ? process.env.URL : 'http://localhost';

//database
export const SUPABASE_URL =
  DATABASE_ENVIROMENT === 'LOCAL' ? process.env.SUPABASE_URL_LOCAL! : process.env.SUPABASE_URL!;
export const SUPABASE_SERVICE_ROLE_KEY =
  DATABASE_ENVIROMENT === 'LOCAL'
    ? process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL!
    : process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const JWT_SECRET_SUPABASE =
  DATABASE_ENVIROMENT === 'LOCAL'
    ? process.env.JWT_SECRET_SUPABASE_LOCAL
    : process.env.JWT_SECRET_SUPABASE!;
