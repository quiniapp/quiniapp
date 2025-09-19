import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { publicRouter, router } from './router';
import { FRONT_URL, PORT, URL } from 'api/envs';
import cookieParser from 'cookie-parser';
// import listEndpoints from 'express-list-endpoints';
const app = express();
const allowedOrigins = [FRONT_URL];

// Middlewares globales
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(cookieParser());
// Rutas
app.use('/api/private', isAuthenticated, express.json({ limit: '5mb' }), router);
app.use('/api', express.json({ limit: '200kb' }), publicRouter);
// console.table(listEndpoints(app));
app.listen(PORT, () => {
  console.log(`Servidor corriendo en ${URL}:${PORT}`);
});
