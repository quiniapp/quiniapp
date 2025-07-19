import { INewScheduleEntity } from '@helper/request/schedule.response';
import { IScheduleEntityBack } from '@helper/types/schedule.type';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export const scheduleBase = (schedule: INewScheduleEntity): IScheduleEntityBack => {
  const timestamp = dayjs().toISOString();
  return {
    schedule_id: uuidv4(),
    name: schedule.name,
    time: schedule.time,
    created_at: timestamp,
    edited_at: timestamp,
  };
};
