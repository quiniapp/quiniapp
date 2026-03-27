import { Router } from 'express';
import { IScheduleLotteryEntityFront } from '@helper/types/schedule-lottery.type';
export type ScheduleLotteryPayload = {
  scheduleLotteries: IScheduleLotteryEntityFront;
};
export declare class ScheduleLotteryRouter {
  router: Router;
  private controller;
  constructor();
  private setupRoutes;
  private newScheduleLotteryHandler;
  private getScheduleLotteryHandler;
}
