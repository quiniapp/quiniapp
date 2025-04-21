import { Router } from 'express';
import { BetController } from '../controller/bet.controller';

const router = Router();
const controller = new BetController();

router.get(`/bet/:id`, controller.get);
router.get(`/bet`, controller.getAll);
router.post(`/bet`, controller.create);
router.put(`/bet/:id`, controller.update);
router.delete(`/bet/:id`, controller.delete);

export default router;
