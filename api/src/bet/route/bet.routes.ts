import { Router } from 'express';
import { BetController } from '../controller/bet.controller';

export class BetRouter {
  public router: Router;

  private controller: BetController;

  constructor() {
    this.router = Router();
    this.controller = new BetController();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.router.get('/:id', this.controller.get);
    this.router.get('/', this.controller.getAll);
    this.router.post('/', this.controller.create);
    this.router.put('/:id', this.controller.update);
    this.router.delete('/:id', this.controller.delete);
  }
}
