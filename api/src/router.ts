import { Router } from 'express';
import { authPrivateRoute, authPublickRoute } from './auth/route/auth.route';
import { UserRouter } from './user/route/user.route';

const router = Router();

// Rutas públicas
export const publicRouter = router.use('/auth', authPublickRoute);

// Rutas privadas
router.use('/auth', authPrivateRoute);
router.use('/user', new UserRouter().router);

const privateRouter = router;
export default privateRouter;
