import { Router } from 'express';
import { UserRouter } from './user/route/user.route';
import { AuthRouter } from './auth/route/auth.route';
import { LotteryRouter } from './lottery/route/lottery.route';
import { ScheduleRouter } from './shcedule/route/schedule.route';
import { TicketRouter } from './ticket/route/ticket.route';
import { ResultsRouter } from './results/route/results.route';
import { BetRouter } from './bet/route/bet.routes';
import { WinnerRouter } from './winners/route/winners.route';
import { CurrentAccountRouter } from './current-account/route/current-account.route';

const router = Router();
const authRouter = new AuthRouter();

// Rutas públicas
export const publicRouter = router.use('/auth', authRouter.publicRouter);

// Rutas privadas
router.use('/auth', authRouter.privateRouter);
router.use('/user', new UserRouter().router);
router.use('/lottery', new LotteryRouter().router);
router.use('/schedule', new ScheduleRouter().router);
router.use('/results', new ResultsRouter().router);
router.use('/ticket', new TicketRouter().router);
router.use('/bet', new BetRouter().router);
router.use('/winners', new WinnerRouter().router);
router.use('/current_account', new CurrentAccountRouter().router);
router.use('/test', (req, res) => {
  res.send('ok');
});

const privateRouter = router;
export default privateRouter;
