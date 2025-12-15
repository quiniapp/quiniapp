import { IScheduleEntityBack } from '../types/schedule.type';

export type INewScheduleEntity = Pick<IScheduleEntityBack, 'name' | 'time' | 'organization_id'>;

export type IUpdateScheduleEntity = Partial<
  Pick<IScheduleEntityBack, 'name' | 'time' | 'organization_id'>
>;

export type IDeleteScheduleEntity = Pick<IScheduleEntityBack, 'schedule_id' | 'organization_id'>;

export type IGetScheduleEntity = Pick<IScheduleEntityBack, 'schedule_id' | 'organization_id'>;
