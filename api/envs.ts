import 'dotenv/config';

const ENVIROMENT = process.env.ENVIROMENT;
const DATABASE_ENVIROMENT = process.env.SUPABASE_ENVIROMENT;

const FRONT_URL_ENVIROMENT = process.env.FRONT_URL_ENVIROMENT;

export const JWT_SECRET_USER = process.env.JWT_SECRET_USER!;
//api
export const PORT = ENVIROMENT === 'LOCAL' ? 3000 : process.env.PORT;
export const URL = ENVIROMENT === 'LOCAL' ? 'http://localhost' : process.env.URL;

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

export const FRONT_URL =
  FRONT_URL_ENVIROMENT === 'PRODUCTION'
    ? process.env.FRONT_ENVIROMET_PRODUCTION
    : FRONT_URL_ENVIROMENT === 'DEVELOP'
      ? process.env.FRONT_ENVIROMET_DEVELOP
      : 'http://localhost:5173';
