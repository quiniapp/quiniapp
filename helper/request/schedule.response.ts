import { IScheduleEntityBack } from '@helper/types/schedule.type';

export type INewScheduleEntity = Pick<IScheduleEntityBack, 'name' | 'time'>;

export type IUpdateScheduleEntity = INewScheduleEntity;

export type IDeleteScheduleEntity = Pick<IScheduleEntityBack, 'schedule_id'>;

export type IGetScheduleEntity = Pick<IScheduleEntityBack, 'schedule_id'>;
