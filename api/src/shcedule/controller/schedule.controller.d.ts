import { IScheduleEntityFront } from '@helper/types/schedule.type';
import {
  IDeleteScheduleEntity,
  IGetScheduleEntity,
  INewScheduleEntity,
  IUpdateScheduleEntity,
} from '@helper/request/schedule.request';
import { SCHEDULE_DAY } from '@helper/types/schedule-lottery.type';
export declare class ScheduleController {
  private repository;
  private scheduleLotteryController;
  create: (props: INewScheduleEntity, organization_id: string) => Promise<IScheduleEntityFront>;
  get: (props: IGetScheduleEntity, organization_id: string) => Promise<IScheduleEntityFront>;
  getAll: (organization_id: string, all?: boolean) => Promise<IScheduleEntityFront[]>;
  getAllByDay: (
    day: SCHEDULE_DAY,
    all: boolean,
    organization_id: string,
    withLotteries?: boolean
  ) => Promise<IScheduleEntityFront[]>;
  update: (
    id: string,
    props: IUpdateScheduleEntity,
    organization_id: string
  ) => Promise<IScheduleEntityFront>;
  delete: (props: IDeleteScheduleEntity, organization_id: string) => Promise<void>;
}
