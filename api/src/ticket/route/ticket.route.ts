import { Router } from 'express';
import { TicketController } from '../controller/ticket.controller';

export class TicketRouter {
  public router: Router;

  private controller: TicketController;

  constructor() {
    this.router = Router();
    this.controller = new TicketController();
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
