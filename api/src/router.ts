import { Router } from 'express';
import { UserRouter } from './user/route/user.route';
import { AuthRouter } from './auth/route/auth.route';
import { LotteryRouter } from './lottery/route/lottery.route';

const router = Router();
const authRouter = new AuthRouter();

// Rutas públicas
export const publicRouter = router.use('/auth', authRouter.publicRouter);

// Rutas privadas
router.use('/auth', authRouter.privateRouter);
router.use('/user', new UserRouter().router);
router.use('/lottery', new LotteryRouter().router);
router.use('/test', (req, res) => {
  res.send('ok');
});

const privateRouter = router;
export default privateRouter;