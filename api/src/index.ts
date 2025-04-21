import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import morgan from 'morgan'; // <--- import morgan
import { isAuthenticated } from '../middlewares/auth.middleware';
import privateRouter, { publicRouter } from './router';

const PORT = process.env.PORT || 3000;
const URL = process.env.URL || 'http://localhost';

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Rutas
app.use('/api', publicRouter);

app.use('/api/private', isAuthenticated, privateRouter);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en ${URL}:${PORT}`);
});
