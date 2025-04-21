import { Router } from 'express';
import { LotteryController } from '../controller/lottery.controller';

const router = Router();
const controller = new LotteryController();

router.get(`/lottery/:id`, controller.get);
router.get(`/lottery`, controller.getAll);
router.post(`/lottery`, controller.create);
router.put(`/lottery/:id`, controller.update);
router.delete(`/lottery/:id`, controller.delete);

export default router;
