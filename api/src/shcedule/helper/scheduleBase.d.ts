import { INewScheduleEntity } from '@helper/request/schedule.request';
import { IScheduleEntityBack } from '@helper/types/schedule.type';
export declare const scheduleBase: (
  schedule: INewScheduleEntity,
  organization_id: string
) => IScheduleEntityBack;
