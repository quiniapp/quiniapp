import { Router } from 'express';
import { PollaAuthRouter } from './auth/route/polla-auth.route';
import { PollaUserRouter } from './user/route/polla-user.route';
import { PollaEditionRouter } from './edition/route/polla-edition.route';
import { PollaBetRouter } from './bet/route/polla-bet.route';
import { PollaResultRouter } from './result/route/polla-result.route';
import { PollaCurrentAccountRouter } from './current-account/route/polla-current-account.route';
import { PollaOrganizationRouter } from './organization/route/polla-organization.route';
import { PollaExpenseRouter } from './expense/route/polla-expense.route';
import {
  pollaGroupRouter,
  pollaLotteryRouter,
  pollaScheduleRouter,
} from './catalog/route/polla-catalog.route';

const authRouter = new PollaAuthRouter();

/** Rutas públicas de Polla: se montan en /api/polla. */
export const pollaPublicRouter = Router();
pollaPublicRouter.use('/auth', authRouter.publicRouter);

/** Rutas autenticadas de Polla: se montan en /api/polla/private. */
export const pollaRouter = Router();

pollaRouter.use('/auth', authRouter.privateRouter);
pollaRouter.use('/organization', new PollaOrganizationRouter().router);
pollaRouter.use('/group', pollaGroupRouter);
pollaRouter.use('/lottery', pollaLotteryRouter);
pollaRouter.use('/schedule', pollaScheduleRouter);
pollaRouter.use('/user', new PollaUserRouter().router);
pollaRouter.use('/edition', new PollaEditionRouter().router);
pollaRouter.use('/bet', new PollaBetRouter().router);
pollaRouter.use('/result', new PollaResultRouter().router);
pollaRouter.use('/current_account', new PollaCurrentAccountRouter().router);
pollaRouter.use('/expense', new PollaExpenseRouter().router);
