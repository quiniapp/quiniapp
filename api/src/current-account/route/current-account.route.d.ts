import { Router } from 'express';
export declare class CurrentAccountRouter {
  router: Router;
  private controller;
  constructor();
  private setupRoutes;
  private getAllCurrentAccountHandler;
  private calculateCurrentAccountHandler;
  private liquidateCurrentAccountHandler;
  private updateCurrentAccountHandler;
  private getCurrentAccountHandler;
  private bulkUpdateCurrentAccountHandler;
  private calculateNetworkCurrentAccountHandler;
  private liquidateNetworkCurrentAccountHandler;
  private getNetworkSummaryHandler;
}
