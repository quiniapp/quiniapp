import { Router } from 'express';
import { authPrivateRoute, authPublickRoute } from './auth/route/auth.route';
import { UserRouter } from './user/route/user.route';

const router = Router();

// Rutas públicas
export const publicRouter = router.use('/auth', authPublickRoute);

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Ruta privada accedida correctamente' });
});

// Rutas privadas
router.use('/auth', authPrivateRoute);
router.use('/user', new UserRouter().router); // 🔥 Instanciás y le pasás el router expuesto

const privateRouter = router;
export default privateRouter;
