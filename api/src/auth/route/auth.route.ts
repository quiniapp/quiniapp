import { Router } from 'express';
import { login, logout } from '../controller/auth.controller';

const router = Router();

export const authPublickRoute = router.post('/login', login); // pública;
export const authPrivateRoute = router.post('/logout', logout); //privada
