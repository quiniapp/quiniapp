import express from 'express';
import { authPrivateRoute, authPublickRoute } from './auth/route/auth.route';

const router = express();
//ruta publica
export const publicRouter = router.use('/auth', authPublickRoute);
//test
router.get('/test', (req, res) => {
  res.json({ message: 'Ruta privada accedida correctamente' });
});

//real
router.use('/auth', authPrivateRoute);

const privateRouter = router;
export default privateRouter;
