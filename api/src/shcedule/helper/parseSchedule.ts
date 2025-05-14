import { IScheduleEntityBack, IScheduleEntityFront } from '@helper/types/schedule.type';

export const parseSchedule = (
  schedule: IScheduleEntityBack,
  active: boolean
): IScheduleEntityFront => {
  return {
    schedule_id: schedule.schedule_id,
    name: schedule.name,
    time: schedule.time,
    active,
  };
};
