import { Router } from 'express';
export declare class BetRouter {
  router: Router;
  private controller;
  private userRepository;
  constructor();
  private setupRoutes;
  /**
   * Resolve the array of organization IDs to query.
   * CASHIER always sees only their own org.
   * All other roles see their org + all sub-orgs (full network).
   */
  private getOrgIds;
  private getAllBets;
  private getTotalAmount;
  private getTotalPrize;
  private getAmountsByTicket;
}
