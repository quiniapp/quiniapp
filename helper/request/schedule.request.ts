import { IScheduleEntityBack } from '../types/schedule.type';

export type INewScheduleEntity = Pick<IScheduleEntityBack, 'name' | 'time'> & {
  active?: boolean;
};

export type IUpdateScheduleEntity = Partial<Pick<IScheduleEntityBack, 'name' | 'time' | 'active'>>;

export type IDeleteScheduleEntity = Pick<IScheduleEntityBack, 'schedule_id'>;

export type IGetScheduleEntity = Pick<IScheduleEntityBack, 'schedule_id'>;
