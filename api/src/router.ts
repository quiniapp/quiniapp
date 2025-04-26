import { Router } from 'express';
import { UserRouter } from './user/route/user.route';
import { AuthRouter } from './auth/route/auth.route';

const router = Router();
const authRouter = new AuthRouter();

// Rutas públicas
export const publicRouter = router.use('/auth', authRouter.publicRouter);

// Rutas privadas
router.use('/auth', authRouter.privateRouter);
router.use('/user', new UserRouter().router);

const privateRouter = router;
export default privateRouter;
