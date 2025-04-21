import { Router } from 'express';
import { ScheduleController } from '../controller/schedule.controller';

const router = Router();
const controller = new ScheduleController();

router.get(`/shcedule/:id`, controller.get);
router.get(`/shcedule`, controller.getAll);
router.post(`/shcedule`, controller.create);
router.put(`/shcedule/:id`, controller.update);
router.delete(`/shcedule/:id`, controller.delete);

export default router;
