import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { isAuthenticated } from '../middlewares/auth.middleware';
import privateRouter, { publicRouter } from './router';
import { PORT, URL } from 'api/envs';
import cookieParser from 'cookie-parser';
import { URLSearchParams } from 'url';

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
app.get('/tiendanube', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    console.log('code', code);
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Falta parámetro code' });
    }

    const tokenUrl = 'https://www.tiendanube.com/apps/authorize/token';
    const data = new URLSearchParams({
      client_id: '17825',
      client_secret: '1fd5ec0737158cfd103940e3f03eb6378533a4f567067cfa',
      grant_type: 'authorization_code',
      code,
    });

    // eslint-disable-next-line no-undef
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: data,
    });
    const result = await response.json();
    console.log('response', result);
    const { access_token, user_id } = result;

    if (!access_token || !user_id) {
      return res.status(400).json({ error: 'No se pudo obtener token' });
    }
    //
    // "store_id": 6228330
    // access_token: '2d078056f31e1b4a3980cac7313b8af4f4963ff5',
    //
    return res.json({ success: true, store_id: user_id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.use('/api', publicRouter);

app.use('/api/private', isAuthenticated, privateRouter);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en ${URL}:${PORT}`);
});
