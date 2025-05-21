import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { isAuthenticated } from '../middlewares/auth.middleware';
import privateRouter, { publicRouter } from './router';
import { PORT, URL } from 'api/envs';
import cookieParser from 'cookie-parser';

const app = express();

const allowedOrigins = ['http://localhost:5173', 'https://quiniapp-web.vercel.app'];

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
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());
// Rutas
app.use('/api', publicRouter);

app.use('/api/private', isAuthenticated, privateRouter);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en ${URL}:${PORT}`);
});
