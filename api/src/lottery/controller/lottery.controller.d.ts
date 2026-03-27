import {
  IDeleteLotteryEntity,
  IGetLotteryEntity,
  INewLotteryEntity,
  IUpdateLotteryEntity,
} from '@helper/request/lottery.request';
import { ILotteryEntityFront } from '@helper/types/lottery.type';
import { SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';
export declare class LotteryController {
  private repository;
  private scheduleLotteryController;
  create: (props: INewLotteryEntity, organization_id: string) => Promise<ILotteryEntityFront>;
  get: (props: IGetLotteryEntity, organization_id: string) => Promise<ILotteryEntityFront>;
  getAll: (all?: boolean, organization_id?: string) => Promise<ILotteryEntityFront[]>;
  getAllByDay: (
    day: SCHEDULE_DAY,
    all: boolean,
    organization_id: string
  ) => Promise<ILotteryEntityFront[]>;
  update: (
    id: string,
    props: IUpdateLotteryEntity,
    organization_id: string
  ) => Promise<ILotteryEntityFront>;
  delete: (props: IDeleteLotteryEntity, organization_id: string) => Promise<void>;
}
