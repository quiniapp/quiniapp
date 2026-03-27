import { Router } from 'express';
export declare class TicketRouter {
  router: Router;
  private controller;
  constructor();
  private setupRoutes;
  private newTicketHandler;
  private getTicketHandler;
  private getAllTicketHandler;
  private getAllTicketNumberHandler;
  private getAllDeletedTicketHandler;
  private updateTicketHandler;
  private deleteTicketHandler;
  private payTicketHandler;
}
